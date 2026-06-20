import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { appUsers, performanceWeeks, coachingRoster, coachingSessions } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import Papa from 'papaparse'
import { COACHING_THRESHOLDS } from '@/config/constants'
import type { AppRole } from '@/config/roles'
import type { EscalationStage } from '@/lib/db/schema'

function parsePct(val: string): number {
  return parseFloat(val.replace('%', '').trim()) || 0
}

function parseNum(val: string): number {
  return parseFloat(val.trim()) || 0
}

function parseGroup(group: string) {
  return group.split(' -> ').map((p) => p.trim()).filter(Boolean)
}

function isDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

const STAGE_ORDER: EscalationStage[] = ['roster', 'c1', 'c2', 'k1', 'k2', 'final']

function nextStage(current: EscalationStage): EscalationStage | null {
  const idx = STAGE_ORDER.indexOf(current)
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null
  return STAGE_ORDER[idx + 1]
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const [caller] = await db.select({ role: appUsers.role, isActive: appUsers.isActive })
    .from(appUsers).where(eq(appUsers.clerkId, userId)).limit(1)
  if (!caller || !caller.isActive) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const role = caller.role as AppRole
  if (!['root', 'gm', 'ops', 'am'].includes(role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

  const text = await file.text()
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })

  if (parsed.errors.length > 0) {
    return Response.json({ error: 'CSV parse error', details: parsed.errors[0] }, { status: 400 })
  }

  // ── Extract weekly employee rows only (depth 4: weekDate → manager → jobTitle → employee) ──
  type WeekRow = {
    weekDate: string; managerName: string; jobTitle: string; employeeName: string
    pph: number; directPct: number; indirectPct: number; gapPct: number
  }

  const weekRows: WeekRow[] = []

  for (const row of parsed.data) {
    const parts = parseGroup(row['Group'] ?? '')
    if (parts.length === 4 && isDate(parts[0]) && !isDate(parts[3])) {
      weekRows.push({
        weekDate: parts[0],
        managerName: parts[1],
        jobTitle: parts[2],
        employeeName: parts[3],
        pph: parseNum(row['PPH'] ?? '0'),
        directPct: parsePct(row['Direct %'] ?? '0%'),
        indirectPct: parsePct(row['Indirect %'] ?? '0%'),
        gapPct: parsePct(row['Gap %'] ?? '0%'),
      })
    }
  }

  if (weekRows.length === 0) {
    return Response.json({ error: 'No valid employee rows found. Check CSV format.' }, { status: 400 })
  }

  // ── Batch upsert performance_weeks ──
  await db.insert(performanceWeeks)
    .values(weekRows.map((r) => ({
      weekDate: r.weekDate,
      managerName: r.managerName,
      jobTitle: r.jobTitle,
      employeeName: r.employeeName,
      pph: r.pph,
      directPct: r.directPct,
      indirectPct: r.indirectPct,
      gapPct: r.gapPct,
      uploadedByClerkId: userId,
    })))
    .onConflictDoUpdate({
      target: [performanceWeeks.weekDate, performanceWeeks.employeeName],
      set: {
        pph: performanceWeeks.pph,
        directPct: performanceWeeks.directPct,
        indirectPct: performanceWeeks.indirectPct,
        gapPct: performanceWeeks.gapPct,
        uploadedByClerkId: userId,
        uploadedAt: new Date(),
      },
    })

  // ── Pull all existing active roster entries in one query ──
  const employeeNames = weekRows.map((r) => r.employeeName)
  const existingEntries = await db.select().from(coachingRoster)
    .where(and(
      eq(coachingRoster.isActive, true),
      inArray(coachingRoster.employeeName, employeeNames)
    ))

  const entriesByName = new Map(existingEntries.map((e) => [e.employeeName, e]))

  const { DIRECT_MIN, PPH_MAX, GAP_MAX, CLEARED_WEEKS_RESET } = COACHING_THRESHOLDS

  // Collect roster inserts and session inserts to batch
  const newRosterRows: (typeof coachingRoster.$inferInsert)[] = []
  // Updates and session creates still done individually but only for entries that changed
  const updates: Array<{ id: number; data: Partial<typeof coachingRoster.$inferInsert>; newStage?: EscalationStage }> = []

  const weekDate = weekRows[0].weekDate

  for (const row of weekRows) {
    const qualifies =
      row.directPct >= DIRECT_MIN &&
      (row.pph < PPH_MAX || row.gapPct > GAP_MAX)

    const existing = entriesByName.get(row.employeeName)

    if (qualifies) {
      if (!existing) {
        // First time flagged — create at c1 directly (auto-advance applied immediately)
        newRosterRows.push({
          employeeName: row.employeeName,
          managerName: row.managerName,
          jobTitle: row.jobTitle,
          currentStage: 'c1',
          cardStatus: 'in_progress',
          triggerPph: row.pph,
          triggerGapPct: row.gapPct,
          triggerDirectPct: row.directPct,
          firstFlaggedWeekDate: weekDate,
          lastFlaggedWeekDate: weekDate,
          consecutiveWeeksFlagged: 1,
          consecutiveWeeksCleared: 0,
          stageHistory: JSON.stringify([{
            stage: 'c1',
            changedAt: new Date().toISOString(),
            changedByClerkId: userId,
            reason: `Auto-flagged: PPH ${Math.round(row.pph)}, Gap ${row.gapPct.toFixed(1)}%, Direct ${row.directPct.toFixed(1)}% for week of ${weekDate}`,
            type: 'auto',
          }]),
          isActive: true,
        })
      } else {
        // Already tracked — advance to next stage if not at final
        const next = nextStage(existing.currentStage as EscalationStage)
        const newFlagged = existing.consecutiveWeeksFlagged + 1
        const history = Array.isArray(existing.stageHistory) ? existing.stageHistory : []

        const update: Partial<typeof coachingRoster.$inferInsert> = {
          consecutiveWeeksFlagged: newFlagged,
          consecutiveWeeksCleared: 0,
          lastFlaggedWeekDate: weekDate,
          updatedAt: new Date(),
        }

        if (next && next !== existing.currentStage) {
          update.currentStage = next
          update.stageHistory = [...history, {
            stage: next,
            changedAt: new Date().toISOString(),
            changedByClerkId: userId,
            reason: `Auto-advance (week ${newFlagged}): PPH ${Math.round(row.pph)}, Gap ${row.gapPct.toFixed(1)}%`,
            type: 'auto',
          }] as typeof history
          updates.push({ id: existing.id, data: update, newStage: next })
        } else {
          updates.push({ id: existing.id, data: update })
        }
      }
    } else if (existing) {
      // Performing well — increment cleared counter
      const newCleared = existing.consecutiveWeeksCleared + 1
      const shouldReset = newCleared >= CLEARED_WEEKS_RESET
      const history = Array.isArray(existing.stageHistory) ? existing.stageHistory : []

      updates.push({
        id: existing.id,
        data: {
          consecutiveWeeksCleared: shouldReset ? 0 : newCleared,
          consecutiveWeeksFlagged: shouldReset ? 0 : existing.consecutiveWeeksFlagged,
          currentStage: shouldReset ? 'roster' : existing.currentStage,
          cardStatus: shouldReset ? 'in_progress' : existing.cardStatus,
          updatedAt: new Date(),
          stageHistory: shouldReset
            ? [...history, {
                stage: 'roster',
                changedAt: new Date().toISOString(),
                changedByClerkId: userId,
                reason: `4-week reset: ${newCleared} consecutive weeks above threshold`,
                type: 'system',
              }]
            : existing.stageHistory,
        },
      })
    }
  }

  // ── Batch insert new roster entries ──
  let newlyFlagged = 0
  if (newRosterRows.length > 0) {
    const inserted = await db.insert(coachingRoster)
      .values(newRosterRows)
      .onConflictDoNothing()
      .returning()
    newlyFlagged = inserted.length

    // Create unassigned coaching sessions for each new entry
    if (inserted.length > 0) {
      const newRowByName = new Map(newRosterRows.map((r) => [r.employeeName, r]))
      await db.insert(coachingSessions)
        .values(inserted.map((entry) => {
          const src = newRowByName.get(entry.employeeName)!
          return {
            rosterEntryId: entry.id,
            escalationStage: 'c1' as EscalationStage,
            weekDate,
            employeeName: entry.employeeName,
            managerName: entry.managerName,
            jobTitle: entry.jobTitle,
            triggerPph: src.triggerPph,
            triggerGapPct: src.triggerGapPct,
            triggerDirectPct: src.triggerDirectPct,
            status: 'unassigned' as const,
          }
        }))
        .onConflictDoNothing()
    }
  }

  // ── Apply individual updates + create sessions for auto-advances ──
  let autoAdvanced = 0
  for (const { id, data, newStage } of updates) {
    await db.update(coachingRoster).set(data).where(eq(coachingRoster.id, id))

    if (newStage) {
      const entry = existingEntries.find((e) => e.id === id)!
      const row = weekRows.find((r) => r.employeeName === entry.employeeName)!
      await db.insert(coachingSessions).values({
        rosterEntryId: id,
        escalationStage: newStage,
        weekDate,
        employeeName: entry.employeeName,
        managerName: entry.managerName,
        jobTitle: entry.jobTitle,
        triggerPph: row.pph,
        triggerGapPct: row.gapPct,
        triggerDirectPct: row.directPct,
        status: 'unassigned',
      }).onConflictDoNothing()
      autoAdvanced++
    }
  }

  return Response.json({
    success: true,
    weekRowsInserted: weekRows.length,
    newlyFlagged,
    autoAdvanced,
  })
}
