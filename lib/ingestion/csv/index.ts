import Papa from 'papaparse'
import { db } from '@/lib/db'
import { employees, actionLogs, uphStandards, appointments, processingThroughput } from '@/lib/db/schema'
import { parseActionLogRow } from './parsers/actionLogs'
import { parseUphStandardRow } from './parsers/uphStandards'
import type { IngestionResult, IngestionError } from '@/lib/ingestion/types'
import { eq } from 'drizzle-orm'

export type CsvFileType =
  | 'action_logs'
  | 'uph_standards'
  | 'appointments'
  | 'throughput'
  | 'employees'

/**
 * Main entry point for CSV ingestion.
 * Accepts a file string (CSV text content), determines the type,
 * parses each row, and batch-inserts into the database.
 *
 * On duplicate records (same employee+timestamp for action logs,
 * same action+size+program for UPH standards), we upsert to allow
 * re-importing the same file safely.
 */
export async function ingestCsv(
  csvText: string,
  fileType: CsvFileType
): Promise<IngestionResult> {
  const startTime = Date.now()

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  if (parsed.errors.length > 0) {
    return {
      success: false,
      recordsProcessed: 0,
      recordsInserted: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
      errors: parsed.errors.map((e) => ({ message: e.message, row: e.row })),
      durationMs: Date.now() - startTime,
      source: 'csv',
    }
  }

  const rows = parsed.data
  const allErrors: IngestionError[] = []
  let inserted = 0
  let skipped = 0
  let failed = 0

  switch (fileType) {
    case 'action_logs': {
      // Build employee lookup map: paylocityId → db id
      const employeeMap = await buildEmployeeMap()

      // Process in batches to avoid exceeding Neon's HTTP request size limits
      const BATCH_SIZE = 500
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE)
        const validRows = []

        for (let j = 0; j < batch.length; j++) {
          const { data, errors } = parseActionLogRow(batch[j], i + j + 2) // +2 for header row + 1-indexed
          if (errors.length > 0) {
            allErrors.push(...errors)
            failed++
            continue
          }
          if (!data) continue

          const employeeId = employeeMap.get(data.employeePaylocityId)
          if (!employeeId) {
            allErrors.push({
              row: i + j + 2,
              field: 'Paylocity Id',
              value: data.employeePaylocityId,
              message: `Employee with Paylocity ID "${data.employeePaylocityId}" not found in database. Import employees first.`,
            })
            skipped++
            continue
          }

          validRows.push({
            employeeId,
            createdAt: data.createdAt,
            date: data.date,
            hour: data.hour,
            location: data.location,
            logType: data.logType,
            itemId: data.itemId,
            action: data.action,
            program: data.program,
            programType: data.programType as any,
            size: data.size as any,
            source: 'csv' as const,
          })
        }

        if (validRows.length > 0) {
          await db
            .insert(actionLogs)
            .values(validRows)
            .onConflictDoNothing() // Skip exact duplicates (same createdAt + employeeId + action)
          inserted += validRows.length
        }
      }
      break
    }

    case 'uph_standards': {
      for (let i = 0; i < rows.length; i++) {
        const { data, errors } = parseUphStandardRow(rows[i], i + 2)
        if (errors.length > 0) { allErrors.push(...errors); failed++; continue }
        if (!data) continue

        await db
          .insert(uphStandards)
          .values({
            action: data.action,
            location: data.location,
            itemSize: data.itemSize as any,
            programProfile: data.programProfile,
            secPerAction: data.secPerAction.toString(),
            pointsPerAction: data.pointsPerAction.toString(),
            uph: data.uph,
          })
          .onConflictDoUpdate({
            target: [uphStandards.action, uphStandards.itemSize, uphStandards.programProfile],
            set: {
              secPerAction: data.secPerAction.toString(),
              pointsPerAction: data.pointsPerAction.toString(),
              uph: data.uph,
            },
          })
        inserted++
      }
      break
    }

    // TODO: Add cases for 'appointments', 'throughput', 'employees'
    // following the same pattern above

    default:
      return {
        success: false,
        recordsProcessed: rows.length,
        recordsInserted: 0,
        recordsSkipped: 0,
        recordsFailed: rows.length,
        errors: [{ message: `Unknown file type: ${fileType}` }],
        durationMs: Date.now() - startTime,
        source: 'csv',
      }
  }

  return {
    success: failed === 0 || inserted > 0,
    recordsProcessed: rows.length,
    recordsInserted: inserted,
    recordsSkipped: skipped,
    recordsFailed: failed,
    errors: allErrors,
    durationMs: Date.now() - startTime,
    source: 'csv',
  }
}

// ============================================================
// Helpers
// ============================================================

async function buildEmployeeMap(): Promise<Map<string, number>> {
  const allEmployees = await db
    .select({ id: employees.id, paylocityId: employees.paylocityId })
    .from(employees)

  return new Map(allEmployees.map((e) => [e.paylocityId, e.id]))
}
