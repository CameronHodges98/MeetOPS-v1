import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { hourlyActionTotals } from '@/lib/db/schema'
import { actionToDept } from '@/lib/utils/actionDeptMap'

export const maxDuration = 60

export interface ActionTotalRow {
  date: string   // YYYY-MM-DD
  hour: number
  action: string
  totalCount: number
  location?: string
}

// POST /api/ingest/action-totals
// Body: { rows: ActionTotalRow[] }
// Rows should already be aggregated (sum of counts per date/hour/action).
// The route maps each action to its department and upserts to hourly_action_totals.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows } = await request.json() as { rows: ActionTotalRow[] }
  if (!rows?.length) return Response.json({ inserted: 0, skipped: 0 })

  let skipped = 0
  const toInsert: typeof hourlyActionTotals.$inferInsert[] = []

  for (const r of rows) {
    const dept = actionToDept(r.action)
    if (!dept) { skipped++; continue }
    if (!r.date || r.hour === undefined || !r.totalCount) { skipped++; continue }

    toInsert.push({
      date: r.date,
      hour: r.hour,
      location: r.location || 'Mesa',
      department: dept,
      action: r.action,
      totalCount: r.totalCount,
      source: 'csv',
    })
  }

  if (toInsert.length === 0) return Response.json({ inserted: 0, skipped })

  await db
    .insert(hourlyActionTotals)
    .values(toInsert)
    .onConflictDoUpdate({
      target: [
        hourlyActionTotals.date,
        hourlyActionTotals.hour,
        hourlyActionTotals.location,
        hourlyActionTotals.department,
        hourlyActionTotals.action,
      ],
      set: { totalCount: hourlyActionTotals.totalCount },
    })

  return Response.json({ inserted: toInsert.length, skipped })
}
