import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { coachingAssignments } from '@/lib/db/schema'

// PATCH /api/coaching/assignments/[id]
// Handles all status transitions + CT form submission + manager completion.
//
// CT transitions:
//   action=start  → sets status=in_progress, ctStartedAt
//   action=submit → sets status=pending_review, ctSubmittedAt, objectiveResults, ctSummaryNotes, dueManagerAt
//
// Manager transitions:
//   action=complete → sets status=complete, completedAt
//   action=reassign → sets trainerClerkId, resets status=assigned, clears CT timestamps
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const assignmentId = Number(id)
  if (!assignmentId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await request.json() as {
    action: 'start' | 'submit' | 'complete' | 'reassign'
    objectiveResults?: { objectiveId: string; result: string; comment?: string }[]
    ctSummaryNotes?: string
    trainerClerkId?: string
    managerNotes?: string
  }

  const role = (sessionClaims?.publicMetadata as Record<string, unknown>)?.role as string | undefined
  const now = new Date()

  // Verify the assignment exists and the caller has permission
  const [existing] = await db
    .select()
    .from(coachingAssignments)
    .where(eq(coachingAssignments.id, assignmentId))
    .limit(1)

  if (!existing) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

  // CTs can only modify their own assignments
  if (role === 'ct' && existing.trainerClerkId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let patch: Partial<typeof coachingAssignments.$inferInsert> = {}

  switch (body.action) {
    case 'start':
      patch = { status: 'in_progress', ctStartedAt: now }
      break

    case 'submit': {
      if (!body.objectiveResults?.length) {
        return NextResponse.json({ error: 'objectiveResults required for submit' }, { status: 400 })
      }
      const dueManagerAt = new Date(now)
      dueManagerAt.setUTCHours(dueManagerAt.getUTCHours() + 24)
      patch = {
        status: 'pending_review',
        objectiveResults: body.objectiveResults,
        ctSummaryNotes: body.ctSummaryNotes ?? null,
        ctSubmittedAt: now,
        dueManagerAt,
      }
      break
    }

    case 'complete':
      patch = {
        status: 'complete',
        completedAt: now,
        managerNotes: body.managerNotes ?? existing.managerNotes,
      }
      break

    case 'reassign':
      if (!body.trainerClerkId) {
        return NextResponse.json({ error: 'trainerClerkId required for reassign' }, { status: 400 })
      }
      patch = {
        trainerClerkId: body.trainerClerkId,
        status: 'assigned',
        ctStartedAt: null,
        ctSubmittedAt: null,
        objectiveResults: null,
        ctSummaryNotes: null,
        dueCtAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        dueManagerAt: null,
      }
      break

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const [updated] = await db
    .update(coachingAssignments)
    .set(patch)
    .where(eq(coachingAssignments.id, assignmentId))
    .returning()

  return NextResponse.json(updated)
}
