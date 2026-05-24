import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { shiftPlans } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// POST /api/shift-plan/unpublish
// Body: { planId }
// Clears publishedAt so the plan can be edited and re-published.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { planId } = await request.json() as { planId: number }
  if (!planId) return Response.json({ error: 'planId required' }, { status: 400 })

  const plan = await db.query.shiftPlans.findFirst({
    where: eq(shiftPlans.id, planId),
  })
  if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 })
  if (!plan.publishedAt) return Response.json({ error: 'Plan is not published' }, { status: 409 })

  const [updated] = await db
    .update(shiftPlans)
    .set({ publishedAt: null, publishedByClerkId: null })
    .where(eq(shiftPlans.id, planId))
    .returning()

  return Response.json(updated)
}
