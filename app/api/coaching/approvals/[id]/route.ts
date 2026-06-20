import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { appUsers, coachingApprovals, coachingRoster, coachingSessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { AppRole } from '@/config/roles'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const [user] = await db.select({ role: appUsers.role, isActive: appUsers.isActive })
    .from(appUsers).where(eq(appUsers.clerkId, userId)).limit(1)
  if (!user || !user.isActive) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const role = user.role as AppRole
  if (!['root', 'gm', 'ops'].includes(role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json() as { decision: 'approved' | 'denied'; reviewNotes?: string }

  const [approval] = await db.select().from(coachingApprovals)
    .where(eq(coachingApprovals.id, Number(id))).limit(1)
  if (!approval) return Response.json({ error: 'Not found' }, { status: 404 })
  if (approval.status !== 'pending') return Response.json({ error: 'Already reviewed' }, { status: 409 })

  // Mark the approval
  const [updated] = await db.update(coachingApprovals)
    .set({
      status: body.decision,
      reviewedByClerkId: userId,
      reviewedAt: new Date(),
      reviewNotes: body.reviewNotes ?? null,
    })
    .where(eq(coachingApprovals.id, Number(id)))
    .returning()

  if (body.decision === 'approved') {
    const [entry] = await db.select().from(coachingRoster)
      .where(eq(coachingRoster.id, approval.rosterEntryId)).limit(1)

    if (entry) {
      const history = Array.isArray(entry.stageHistory) ? entry.stageHistory : []
      const historyEntry = {
        stage: approval.toStage ?? entry.currentStage,
        changedAt: new Date().toISOString(),
        changedByClerkId: userId,
        reason: `Approved: ${approval.reason}`,
        type: approval.type,
      }

      if (approval.type === 'auto_advance' || approval.type === 'manual_move') {
        const newStage = approval.toStage!
        await db.update(coachingRoster)
          .set({
            currentStage: newStage,
            stageHistory: [...history, historyEntry],
            updatedAt: new Date(),
          })
          .where(eq(coachingRoster.id, entry.id))

        // Create a coaching session for the new stage
        if (newStage !== 'roster') {
          await db.insert(coachingSessions).values({
            rosterEntryId: entry.id,
            escalationStage: newStage,
            weekDate: entry.lastFlaggedWeekDate ?? new Date().toISOString().split('T')[0],
            employeeName: entry.employeeName,
            managerName: entry.managerName,
            jobTitle: entry.jobTitle,
            triggerPph: entry.triggerPph,
            triggerGapPct: entry.triggerGapPct,
            triggerDirectPct: entry.triggerDirectPct,
            status: 'unassigned',
          }).onConflictDoNothing()
        }
      } else if (approval.type === 'exempt') {
        await db.update(coachingRoster)
          .set({ cardStatus: 'exempt', stageHistory: [...history, historyEntry], updatedAt: new Date() })
          .where(eq(coachingRoster.id, entry.id))
      }
    }
  }

  return Response.json(updated)
}
