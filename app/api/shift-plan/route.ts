import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { shiftPlans, shiftPlanSubmissions, departmentRosters } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { APP_CONFIG, PRODUCTION_DEPARTMENTS } from '@/config/constants'

// GET /api/shift-plan?date=YYYY-MM-DD
// Returns the plan for a date, creating it if it doesn't exist yet.
// Also returns roster counts and submission status per department.
export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  const location = searchParams.get('location') ?? APP_CONFIG.DEFAULT_LOCATION

  // Get or create the plan shell
  let plan = await db.query.shiftPlans.findFirst({
    where: and(eq(shiftPlans.date, date), eq(shiftPlans.location, location)),
  })

  if (!plan) {
    const [created] = await db
      .insert(shiftPlans)
      .values({ date, location })
      .onConflictDoNothing()
      .returning()

    // Race condition guard — re-fetch if insert was a no-op
    plan = created ?? await db.query.shiftPlans.findFirst({
      where: and(eq(shiftPlans.date, date), eq(shiftPlans.location, location)),
    })
  }

  if (!plan) return Response.json({ error: 'Failed to create plan' }, { status: 500 })

  // Persistent roster counts per department (updated only on hires/terminations)
  const rosterRows = await db
    .select()
    .from(departmentRosters)
    .where(eq(departmentRosters.location, location))

  // Determine day type from the requested date
  const dayOfWeek = new Date(date + 'T12:00:00').getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6
  const dayType: 'weekday' | 'weekend' = isWeekend ? 'weekend' : 'weekday'

  const rosterByDept: Record<string, { count: number; shiftSchedule: unknown }> = {}
  for (const row of rosterRows) {
    rosterByDept[row.department] = { count: row.count, shiftSchedule: row.shiftSchedule }
  }

  // Existing submissions for this plan
  const submissions = await db
    .select()
    .from(shiftPlanSubmissions)
    .where(eq(shiftPlanSubmissions.shiftPlanId, plan.id))

  const submissionByDept = Object.fromEntries(
    submissions.map((s) => [s.department, s])
  )

  const departments = PRODUCTION_DEPARTMENTS.map((dept) => {
    const raw = rosterByDept[dept]?.shiftSchedule
    // Extract the day-type-specific schedule from { weekday, weekend } structure.
    // If legacy flat array, treat as weekday.
    let shiftSchedule: import('@/features/shift-plan/utils').ShiftEntry[] | null = null
    if (Array.isArray(raw)) {
      shiftSchedule = dayType === 'weekday' ? (raw as import('@/features/shift-plan/utils').ShiftEntry[]) : null
    } else if (raw && typeof raw === 'object') {
      const typed = raw as Record<string, unknown>
      const arr = typed[dayType]
      shiftSchedule = Array.isArray(arr) && arr.length > 0
        ? arr as import('@/features/shift-plan/utils').ShiftEntry[]
        : null
    }

    return {
      department: dept,
      scheduledCount: rosterByDept[dept]?.count ?? 0,
      shiftSchedule,
      submission: submissionByDept[dept] ?? null,
    }
  })

  return Response.json({ plan, departments })
}
