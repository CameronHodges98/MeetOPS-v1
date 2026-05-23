import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { flexPlanEntries, shiftPlans } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// GET /api/shift-plan/flex?planId=123
export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const planId = Number(searchParams.get('planId'))
  if (!planId) return Response.json({ error: 'planId required' }, { status: 400 })

  const rows = await db
    .select()
    .from(flexPlanEntries)
    .where(eq(flexPlanEntries.shiftPlanId, planId))
    .orderBy(flexPlanEntries.quarter, flexPlanEntries.createdAt)

  return Response.json(rows)
}

// POST /api/shift-plan/flex
// Body: { planId, quarter, fromDepartment, toDepartment, headcountMoved, notes? }
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    planId: number
    quarter: number
    fromDepartment: string
    toDepartment: string
    headcountMoved: number
    notes?: string
  }

  const { planId, quarter, fromDepartment, toDepartment, headcountMoved, notes } = body
  if (!planId || !quarter || !fromDepartment || !toDepartment || !headcountMoved) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (fromDepartment === toDepartment) {
    return Response.json({ error: 'From and To departments must differ' }, { status: 400 })
  }

  // Block edits after publish
  const plan = await db.query.shiftPlans.findFirst({
    where: eq(shiftPlans.id, planId),
  })
  if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 })
  if (plan.publishedAt) {
    return Response.json({ error: 'Plan is already published' }, { status: 409 })
  }

  const [row] = await db
    .insert(flexPlanEntries)
    .values({
      shiftPlanId: planId,
      quarter,
      fromDepartment,
      toDepartment,
      headcountMoved,
      notes: notes ?? null,
      createdByClerkId: userId,
    })
    .returning()

  return Response.json(row)
}
