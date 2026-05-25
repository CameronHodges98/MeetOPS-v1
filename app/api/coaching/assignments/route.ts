import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { coachingAssignments, coachingCandidates, coachingTemplates, userProfiles } from '@/lib/db/schema'
import { eq, and, inArray, desc } from 'drizzle-orm'
import { addDays } from 'date-fns'

const CT_CAPACITY_LIMIT = 5

// GET /api/coaching/assignments?status=assigned|in_progress|pending_review|complete&trainerClerkId=<id>
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const trainerClerkId = searchParams.get('trainerClerkId')

  const conditions = []
  if (status) conditions.push(eq(coachingAssignments.status, status as 'assigned' | 'in_progress' | 'pending_review' | 'complete'))
  if (trainerClerkId) conditions.push(eq(coachingAssignments.trainerClerkId, trainerClerkId))

  const assignments = await db
    .select({
      id: coachingAssignments.id,
      candidateId: coachingAssignments.candidateId,
      templateId: coachingAssignments.templateId,
      assignedByClerkId: coachingAssignments.assignedByClerkId,
      trainerClerkId: coachingAssignments.trainerClerkId,
      managerNotes: coachingAssignments.managerNotes,
      status: coachingAssignments.status,
      objectiveResults: coachingAssignments.objectiveResults,
      ctSummaryNotes: coachingAssignments.ctSummaryNotes,
      ctStartedAt: coachingAssignments.ctStartedAt,
      ctSubmittedAt: coachingAssignments.ctSubmittedAt,
      dueCtAt: coachingAssignments.dueCtAt,
      dueManagerAt: coachingAssignments.dueManagerAt,
      completedAt: coachingAssignments.completedAt,
      createdAt: coachingAssignments.createdAt,
      // Candidate info
      employeeName: coachingCandidates.employeeName,
      managerName: coachingCandidates.managerName,
      jobTitle: coachingCandidates.jobTitle,
      avgPph: coachingCandidates.avgPph,
      avgGapPct: coachingCandidates.avgGapPct,
      // Template info
      templateName: coachingTemplates.name,
      templateDepartment: coachingTemplates.department,
      templateObjectives: coachingTemplates.objectives,
      // Trainer info
      trainerName: userProfiles.displayName,
    })
    .from(coachingAssignments)
    .innerJoin(coachingCandidates, eq(coachingAssignments.candidateId, coachingCandidates.id))
    .innerJoin(coachingTemplates, eq(coachingAssignments.templateId, coachingTemplates.id))
    .leftJoin(userProfiles, eq(coachingAssignments.trainerClerkId, userProfiles.clerkId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(coachingAssignments.createdAt))
    .limit(200)

  return NextResponse.json(assignments)
}

// POST /api/coaching/assignments — create a new assignment
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    candidateId: number
    templateId: number
    trainerClerkId: string
    managerNotes?: string
  }

  // Enforce CT capacity limit
  const [{ count }] = await db
    .select({ count: coachingAssignments.id })
    .from(coachingAssignments)
    .where(
      and(
        eq(coachingAssignments.trainerClerkId, body.trainerClerkId),
        inArray(coachingAssignments.status, ['assigned', 'in_progress', 'pending_review'])
      )
    )
    .limit(1)
    .$dynamic()

  // Count active assignments for this trainer
  const activeRows = await db
    .select({ id: coachingAssignments.id })
    .from(coachingAssignments)
    .where(
      and(
        eq(coachingAssignments.trainerClerkId, body.trainerClerkId),
        inArray(coachingAssignments.status, ['assigned', 'in_progress', 'pending_review'])
      )
    )

  if (activeRows.length >= CT_CAPACITY_LIMIT) {
    return NextResponse.json(
      { error: `This CT already has ${CT_CAPACITY_LIMIT} active sessions` },
      { status: 422 }
    )
  }

  const now = new Date()
  const dueCtAt = addDays(now, 1)

  const [assignment] = await db
    .insert(coachingAssignments)
    .values({
      candidateId: body.candidateId,
      templateId: body.templateId,
      assignedByClerkId: userId,
      trainerClerkId: body.trainerClerkId,
      managerNotes: body.managerNotes,
      status: 'assigned',
      dueCtAt,
    })
    .returning()

  // Link candidate to this assignment
  await db
    .update(coachingCandidates)
    .set({ assignmentId: assignment.id })
    .where(eq(coachingCandidates.id, body.candidateId))

  return NextResponse.json(assignment, { status: 201 })
}

// PATCH /api/coaching/assignments — update status, results, reassign
export async function PATCH(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    id: number
    status?: 'assigned' | 'in_progress' | 'pending_review' | 'complete'
    objectiveResults?: unknown
    ctSummaryNotes?: string
    trainerClerkId?: string   // reassign
    managerNotes?: string
  }

  const now = new Date()
  const patch: Record<string, unknown> = { updatedAt: now }

  if (body.status) patch.status = body.status
  if (body.objectiveResults !== undefined) patch.objectiveResults = body.objectiveResults
  if (body.ctSummaryNotes !== undefined) patch.ctSummaryNotes = body.ctSummaryNotes
  if (body.managerNotes !== undefined) patch.managerNotes = body.managerNotes
  if (body.trainerClerkId !== undefined) patch.trainerClerkId = body.trainerClerkId

  // Auto-set timestamps on status transitions
  if (body.status === 'in_progress') patch.ctStartedAt = now
  if (body.status === 'pending_review') {
    patch.ctSubmittedAt = now
    patch.dueManagerAt = addDays(now, 1)
  }
  if (body.status === 'complete') patch.completedAt = now

  const [updated] = await db
    .update(coachingAssignments)
    .set(patch as Partial<typeof coachingAssignments.$inferInsert>)
    .where(eq(coachingAssignments.id, body.id))
    .returning()

  return NextResponse.json(updated)
}
