import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { appUsers, coachingSessions, coachingRoster } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

// GET /api/coaching/ct/sessions
// Returns every coaching session assigned to the calling Certified Trainer,
// enriched with the roster card's current stage and status. The CT workspace
// splits these into an active queue (assigned / in_coaching) and history
// (review / complete) on the client.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const [caller] = await db
    .select({ role: appUsers.role, isActive: appUsers.isActive })
    .from(appUsers).where(eq(appUsers.clerkId, userId)).limit(1)
  if (!caller || !caller.isActive) return Response.json({ error: 'Forbidden' }, { status: 403 })

  // Only CTs (and root, for support/QA) consume this endpoint.
  if (!['ct', 'root'].includes(caller.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await db
    .select({
      session: coachingSessions,
      currentStage: coachingRoster.currentStage,
      cardStatus: coachingRoster.cardStatus,
      consecutiveWeeksFlagged: coachingRoster.consecutiveWeeksFlagged,
    })
    .from(coachingSessions)
    .innerJoin(coachingRoster, eq(coachingSessions.rosterEntryId, coachingRoster.id))
    .where(and(eq(coachingSessions.assignedCtClerkId, userId), eq(coachingRoster.isActive, true)))
    .orderBy(desc(coachingSessions.updatedAt))

  const sessions = rows.map((r) => ({
    ...r.session,
    currentStage: r.currentStage,
    cardStatus: r.cardStatus,
    consecutiveWeeksFlagged: r.consecutiveWeeksFlagged,
  }))

  return Response.json({ sessions })
}
