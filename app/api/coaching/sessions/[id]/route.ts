import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { appUsers, coachingSessions, coachingRoster } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { AppRole } from '@/config/roles'
import type { CoachingStatus } from '@/lib/db/schema'

// Status transitions a Certified Trainer is allowed to drive. Everything past
// `review` (manager review → complete) belongs to a manager.
const CT_ALLOWED_STATUSES: CoachingStatus[] = ['in_coaching', 'review']

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const [caller] = await db.select({ role: appUsers.role, isActive: appUsers.isActive })
    .from(appUsers).where(eq(appUsers.clerkId, userId)).limit(1)
  if (!caller || !caller.isActive) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const role = caller.role as AppRole
  const isCt = role === 'ct'

  const { id } = await params
  const body = await request.json() as {
    status?: CoachingStatus
    assignedCtClerkId?: string
    formData?: unknown
    checklistTemplateId?: number
    ctNotes?: string
    managerNotes?: string
  }

  // Load the session up front — needed for CT ownership checks.
  const [session] = await db.select().from(coachingSessions)
    .where(eq(coachingSessions.id, Number(id))).limit(1)
  if (!session) return Response.json({ error: 'Not found' }, { status: 404 })

  // ── Certified Trainer guardrails ──────────────────────────────
  // A CT may only touch sessions assigned to them, may only move the session
  // through their own lifecycle stages, and may never write manager-only fields
  // or reassign the trainer.
  if (isCt) {
    if (session.assignedCtClerkId !== userId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (body.assignedCtClerkId !== undefined || body.managerNotes !== undefined) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (body.status !== undefined && !CT_ALLOWED_STATUSES.includes(body.status)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const now = new Date()
  const updates: Record<string, unknown> = { updatedAt: now }

  if (body.status !== undefined) {
    updates.status = body.status
    if (body.status === 'in_coaching') updates.inCoachingAt = now
    if (body.status === 'review') updates.reviewAt = now
    if (body.status === 'complete') {
      updates.completedAt = now
      // Mark the roster card as completed
      await db.update(coachingRoster)
        .set({ cardStatus: 'completed', updatedAt: now })
        .where(eq(coachingRoster.id, session.rosterEntryId))
    }
  }
  if (body.assignedCtClerkId !== undefined) {
    updates.assignedCtClerkId = body.assignedCtClerkId
    updates.assignedByClerkId = userId
    updates.assignedAt = now
    if (!body.status) updates.status = 'assigned'
  }
  if (body.checklistTemplateId !== undefined) updates.checklistTemplateId = body.checklistTemplateId
  if (body.formData !== undefined) updates.formData = body.formData
  if (body.ctNotes !== undefined) updates.ctNotes = body.ctNotes
  if (body.managerNotes !== undefined) updates.managerNotes = body.managerNotes

  const [updated] = await db.update(coachingSessions)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set(updates as any)
    .where(eq(coachingSessions.id, Number(id)))
    .returning()

  return Response.json(updated)
}
