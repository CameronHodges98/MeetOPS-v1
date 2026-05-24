import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { shiftPlans, shiftPlanSubmissions, flexPlanEntries, departmentRosters } from '@/lib/db/schema'
import { eq, and, lt, desc, inArray } from 'drizzle-orm'
import { APP_CONFIG, PRODUCTION_DEPARTMENTS } from '@/config/constants'

// GET /api/shift-plan/history?location=Mesa&limit=30
// Returns past shift plans with submissions, flex entries, and roster counts.
export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const location = searchParams.get('location') ?? APP_CONFIG.DEFAULT_LOCATION
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '30'), 90)
  const today    = new Date().toISOString().slice(0, 10)

  const plans = await db
    .select()
    .from(shiftPlans)
    .where(and(eq(shiftPlans.location, location), lt(shiftPlans.date, today)))
    .orderBy(desc(shiftPlans.date))
    .limit(limit)

  if (plans.length === 0) return Response.json([])

  const planIds = plans.map((p) => p.id)

  const [submissions, flexes, rosterRows] = await Promise.all([
    db.select().from(shiftPlanSubmissions).where(inArray(shiftPlanSubmissions.shiftPlanId, planIds)),
    db.select().from(flexPlanEntries).where(inArray(flexPlanEntries.shiftPlanId, planIds)),
    db.select().from(departmentRosters).where(eq(departmentRosters.location, location)),
  ])

  const rosterByDept: Record<string, number> = {}
  for (const row of rosterRows) {
    rosterByDept[row.department] = row.count
  }

  const subsByPlan  = new Map<number, typeof submissions>()
  const flexByPlan  = new Map<number, typeof flexes>()

  for (const s of submissions) {
    if (!subsByPlan.has(s.shiftPlanId)) subsByPlan.set(s.shiftPlanId, [])
    subsByPlan.get(s.shiftPlanId)!.push(s)
  }
  for (const f of flexes) {
    if (!flexByPlan.has(f.shiftPlanId)) flexByPlan.set(f.shiftPlanId, [])
    flexByPlan.get(f.shiftPlanId)!.push(f)
  }

  const result = plans.map((plan) => {
    const planSubs  = subsByPlan.get(plan.id) ?? []
    const subByDept = Object.fromEntries(planSubs.map((s) => [s.department, s]))

    const departments = PRODUCTION_DEPARTMENTS.map((dept) => ({
      department: dept,
      scheduledCount: rosterByDept[dept] ?? 0,
      submission: subByDept[dept] ?? null,
    }))

    return {
      plan,
      departments,
      flexEntries: flexByPlan.get(plan.id) ?? [],
    }
  })

  return Response.json(result)
}
