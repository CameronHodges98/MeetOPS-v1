import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { employees, actionLogs } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'

export const maxDuration = 60

const VALID_JOB_TITLES = new Set([
  'Picker', 'Inventory Processor', 'Load Out', 'Put Away',
  'Lot Attendant', 'Returns Clerk', 'Material Handler',
  'Area Manager', 'Safety Coordinator',
])
const VALID_LOG_TYPES = new Set(['appointment', 'item', 'container'])
const VALID_PROGRAM_TYPES = new Set([
  'RC Sortable', 'RC Nonsort', 'FC Sortable', 'FC Nonsort', 'Non-Sort RC No', 'XL',
])
const VALID_SIZES = new Set(['small', 'medium', 'large', 'x-large'])

function toStatus(raw: string): 'active' | 'inactive' | 'on_leave' {
  const s = raw.toLowerCase()
  if (s === 'inactive') return 'inactive'
  if (s === 'on_leave' || s === 'on leave') return 'on_leave'
  return 'active'
}

export interface IngestEmployeeRow {
  paylocityId: string
  cargoId: number | null
  name: string
  jobTitle: string
  status: string
  location: string
}

export interface IngestActionRow {
  paylocityId: string
  createdAt: string
  date: string
  hour: string
  location: string
  logType: string
  itemId: string
  action: string
  program: string
  programType: string
  size: string
}

export interface IngestBatchBody {
  employees?: IngestEmployeeRow[]
  rows: IngestActionRow[]
  isFirst: boolean
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body: IngestBatchBody = await request.json()
  const { employees: empRows, rows, isFirst } = body

  // First batch: upsert all unique employees discovered in the file
  if (isFirst && empRows && empRows.length > 0) {
    const validEmps = empRows
      .filter((e) => e.paylocityId && e.name && VALID_JOB_TITLES.has(e.jobTitle))
      .map((e) => ({
        paylocityId: e.paylocityId.trim(),
        cargoId: e.cargoId,
        name: e.name.trim(),
        jobTitle: e.jobTitle as typeof employees.$inferInsert['jobTitle'],
        status: toStatus(e.status),
        location: e.location.trim() || 'Mesa',
      }))

    if (validEmps.length > 0) {
      await db
        .insert(employees)
        .values(validEmps)
        .onConflictDoUpdate({
          target: employees.paylocityId,
          set: {
            name: employees.name,
            jobTitle: employees.jobTitle,
            status: employees.status,
            location: employees.location,
            cargoId: employees.cargoId,
          },
        })
    }
  }

  if (!rows || rows.length === 0) {
    return Response.json({ inserted: 0, skipped: 0 })
  }

  // Resolve paylocityId → internal employee id for this batch
  const paylocityIds = [...new Set(rows.map((r) => r.paylocityId.trim()))]
  const empRecords = await db
    .select({ id: employees.id, paylocityId: employees.paylocityId })
    .from(employees)
    .where(inArray(employees.paylocityId, paylocityIds))
  const idMap = Object.fromEntries(empRecords.map((e) => [e.paylocityId, e.id]))

  let skipped = 0
  const toInsert: typeof actionLogs.$inferInsert[] = []

  for (const r of rows) {
    const employeeId = idMap[r.paylocityId.trim()]
    if (!employeeId) { skipped++; continue }
    if (!VALID_LOG_TYPES.has(r.logType)) { skipped++; continue }

    toInsert.push({
      employeeId,
      createdAt: new Date(r.createdAt),
      date: r.date,
      hour: r.hour,
      location: r.location || 'Mesa',
      logType: r.logType as typeof actionLogs.$inferInsert['logType'],
      itemId: r.itemId ? Number(r.itemId) : null,
      action: r.action,
      program: r.program || null,
      programType: (VALID_PROGRAM_TYPES.has(r.programType)
        ? r.programType
        : null) as typeof actionLogs.$inferInsert['programType'],
      size: (VALID_SIZES.has(r.size)
        ? r.size
        : null) as typeof actionLogs.$inferInsert['size'],
      source: 'csv',
    })
  }

  if (toInsert.length > 0) {
    await db.insert(actionLogs).values(toInsert)
  }

  return Response.json({ inserted: toInsert.length, skipped })
}
