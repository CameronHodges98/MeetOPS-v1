import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { shiftPlanSubmissions, shiftPlans } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export interface ExemptEntry {
  count: number
  reason: string
}

// GET /api/shift-plan/submissions?planId=123
export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const planId = Number(searchParams.get('planId'))
  if (!planId) return Response.json({ error: 'planId required' }, { status: 400 })

  const rows = await db
    .select()
    .from(shiftPlanSubmissions)
    .where(eq(shiftPlanSubmissions.shiftPlanId, planId))

  return Response.json(rows)
}

// POST /api/shift-plan/submissions
// Body: { planId, department, calloutCount, otCount, exemptEntries }
// Upserts submission; blocked if plan is already published.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    planId: number
    department: string
    calloutCount: number
    otCount: number
    exemptEntries: ExemptEntry[]
  }

  const { planId, department, calloutCount, otCount, exemptEntries } = body
  if (!planId || !department) {
    return Response.json({ error: 'planId and department required' }, { status: 400 })
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
    .insert(shiftPlanSubmissions)
    .values({
      shiftPlanId: planId,
      department,
      calloutCount: calloutCount ?? 0,
      otCount: otCount ?? 0,
      exemptEntries: exemptEntries ?? [],
      submittedAt: new Date(),
      submittedByClerkId: userId,
    })
    .onConflictDoUpdate({
      target: [shiftPlanSubmissions.shiftPlanId, shiftPlanSubmissions.department],
      set: {
        calloutCount: calloutCount ?? 0,
        otCount: otCount ?? 0,
        exemptEntries: exemptEntries ?? [],
        submittedAt: new Date(),
        submittedByClerkId: userId,
        updatedAt: new Date(),
      },
    })
    .returning()

  return Response.json(row)
}

// DELETE /api/shift-plan/submissions
// Body: { planId, department }
// Clears a submission back to zeroes and removes the submittedAt timestamp.
export async function DELETE(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { planId, department } = await request.json() as { planId: number; department: string }
  if (!planId || !department) {
    return Response.json({ error: 'planId and department required' }, { status: 400 })
  }

  const plan = await db.query.shiftPlans.findFirst({ where: eq(shiftPlans.id, planId) })
  if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 })
  if (plan.publishedAt) return Response.json({ error: 'Plan is already published' }, { status: 409 })

  await db
    .update(shiftPlanSubmissions)
    .set({
      calloutCount: 0,
      otCount: 0,
      exemptEntries: [],
      submittedAt: null,
      submittedByClerkId: null,
      updatedAt: new Date(),
    })
    .where(and(eq(shiftPlanSubmissions.shiftPlanId, planId), eq(shiftPlanSubmissions.department, department)))

  return Response.json({ ok: true })
}
