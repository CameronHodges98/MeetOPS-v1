import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { appUsers, coachingRoster, coachingApprovals, coachingSessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { AppRole } from '@/config/roles'
import type { EscalationStage, CardStatus } from '@/lib/db/schema'

async function getCaller(userId: string) {
  const [user] = await db.select({ role: appUsers.role, isActive: appUsers.isActive, name: appUsers.name })
    .from(appUsers).where(eq(appUsers.clerkId, userId)).limit(1)
  if (!user || !user.isActive) return null
  return user
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await getCaller(userId)
  if (!caller) return Response.json({ error: 'Forbidden' }, { status: 403 })
  // CTs cannot move cards or change card status on the disciplinary board.
  if (caller.role === 'ct') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json() as {
    action: 'request_move' | 'set_status' | 'direct_move'
    toStage?: EscalationStage
    cardStatus?: CardStatus
    reason?: string
  }

  const [entry] = await db.select().from(coachingRoster)
    .where(eq(coachingRoster.id, Number(id))).limit(1)
  if (!entry) return Response.json({ error: 'Not found' }, { status: 404 })

  const role = caller.role as AppRole
  const canDirectMove = ['root', 'gm', 'ops'].includes(role)

  if (body.action === 'request_move' || body.action === 'direct_move') {
    if (!body.toStage) return Response.json({ error: 'toStage required' }, { status: 400 })

    if (canDirectMove || body.action === 'direct_move') {
      // OM/GM/Root — apply immediately
      const historyEntry = {
        stage: body.toStage,
        changedAt: new Date().toISOString(),
        changedByClerkId: userId,
        reason: body.reason ?? 'Direct move',
        type: 'manual',
      }
      const history = Array.isArray(entry.stageHistory) ? entry.stageHistory : []

      const [updated] = await db.update(coachingRoster)
        .set({
          currentStage: body.toStage,
          stageHistory: [...history, historyEntry],
          updatedAt: new Date(),
        })
        .where(eq(coachingRoster.id, Number(id)))
        .returning()

      // Create a coaching session for the new stage if moving into a board stage
      if (body.toStage !== 'roster') {
        const existingSession = await db.select({ id: coachingSessions.id })
          .from(coachingSessions)
          .where(eq(coachingSessions.rosterEntryId, Number(id)))
          .limit(1)

        const hasSession = existingSession.some((s) => s.id)
        if (!hasSession) {
          await db.insert(coachingSessions).values({
            rosterEntryId: Number(id),
            escalationStage: body.toStage,
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
      }

      return Response.json(updated)
    } else {
      // AM — create pending approval
      if (!body.reason?.trim()) return Response.json({ error: 'Reason required' }, { status: 400 })

      const [approval] = await db.insert(coachingApprovals).values({
        rosterEntryId: Number(id),
        type: 'manual_move',
        requestedByClerkId: userId,
        fromStage: entry.currentStage,
        toStage: body.toStage,
        reason: body.reason,
        status: 'pending',
      }).returning()

      return Response.json({ pending: true, approval })
    }
  }

  if (body.action === 'set_status') {
    if (!body.cardStatus) return Response.json({ error: 'cardStatus required' }, { status: 400 })

    if (body.cardStatus === 'exempt') {
      if (!canDirectMove) {
        // AM exempting — needs approval
        if (!body.reason?.trim()) return Response.json({ error: 'Reason required' }, { status: 400 })
        const [approval] = await db.insert(coachingApprovals).values({
          rosterEntryId: Number(id),
          type: 'exempt',
          requestedByClerkId: userId,
          fromStage: entry.currentStage,
          toStage: entry.currentStage,
          reason: body.reason,
          status: 'pending',
        }).returning()
        return Response.json({ pending: true, approval })
      }
    }

    const [updated] = await db.update(coachingRoster)
      .set({ cardStatus: body.cardStatus, updatedAt: new Date() })
      .where(eq(coachingRoster.id, Number(id)))
      .returning()

    return Response.json(updated)
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 })
}
