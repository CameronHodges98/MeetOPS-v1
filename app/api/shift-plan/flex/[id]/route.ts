import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { flexPlanEntries, shiftPlans } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// DELETE /api/shift-plan/flex/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const entryId = Number(id)
  if (!entryId) return Response.json({ error: 'Invalid id' }, { status: 400 })

  const entry = await db.query.flexPlanEntries.findFirst({
    where: eq(flexPlanEntries.id, entryId),
  })
  if (!entry) return Response.json({ error: 'Entry not found' }, { status: 404 })

  // Block deletes after publish
  const plan = await db.query.shiftPlans.findFirst({
    where: eq(shiftPlans.id, entry.shiftPlanId),
  })
  if (plan?.publishedAt) {
    return Response.json({ error: 'Plan is already published' }, { status: 409 })
  }

  await db.delete(flexPlanEntries).where(eq(flexPlanEntries.id, entryId))

  return Response.json({ success: true })
}
