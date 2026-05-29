import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { eq, desc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  coachingAssignments,
  coachingCandidates,
  coachingTemplates,
  userProfiles,
} from '@/lib/db/schema'

// GET /api/coaching/assignments
// - Manager (no role): returns all assignments with candidate info
// - CT (role=ct): returns only their assignments
// Query params: ?uploadId=X to filter by upload
export async function GET(request: Request) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const uploadIdParam = searchParams.get('uploadId')

  const role = (sessionClaims?.publicMetadata as Record<string, unknown>)?.role as string | undefined

  if (role === 'ct') {
    // CT: only see their own assignments
    const assignments = await db
      .select({
        assignment: coachingAssignments,
        candidate: coachingCandidates,
        template: coachingTemplates,
      })
      .from(coachingAssignments)
      .innerJoin(coachingCandidates, eq(coachingAssignments.candidateId, coachingCandidates.id))
      .innerJoin(coachingTemplates, eq(coachingAssignments.templateId, coachingTemplates.id))
      .where(eq(coachingAssignments.trainerClerkId, userId))
      .orderBy(desc(coachingAssignments.createdAt))

    return NextResponse.json(assignments)
  }

  // Manager: all assignments, optionally filtered by upload
  let candidateIds: number[] | null = null
  if (uploadIdParam) {
    const candidates = await db
      .select({ id: coachingCandidates.id })
      .from(coachingCandidates)
      .where(eq(coachingCandidates.uploadId, Number(uploadIdParam)))
    candidateIds = candidates.map((c) => c.id)
  }

  const query = db
    .select({
      assignment: coachingAssignments,
      candidate: coachingCandidates,
      template: coachingTemplates,
      trainer: userProfiles,
    })
    .from(coachingAssignments)
    .innerJoin(coachingCandidates, eq(coachingAssignments.candidateId, coachingCandidates.id))
    .innerJoin(coachingTemplates, eq(coachingAssignments.templateId, coachingTemplates.id))
    .leftJoin(userProfiles, eq(coachingAssignments.trainerClerkId, userProfiles.clerkId))
    .orderBy(desc(coachingAssignments.createdAt))

  const results = candidateIds
    ? await query.where(inArray(coachingAssignments.candidateId, candidateIds))
    : await query

  return NextResponse.json(results)
}

// POST /api/coaching/assignments
// Body: { candidateId, trainerClerkId, managerNotes? }
// Auto-uses the default template (seeds if needed)
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    candidateId: number
    trainerClerkId: string
    managerNotes?: string
  }

  const { candidateId, trainerClerkId, managerNotes } = body
  if (!candidateId || !trainerClerkId) {
    return NextResponse.json({ error: 'Missing candidateId or trainerClerkId' }, { status: 400 })
  }

  // Resolve or seed the default template
  let templates = await db
    .select({ id: coachingTemplates.id })
    .from(coachingTemplates)
    .where(eq(coachingTemplates.isActive, true))
    .limit(1)

  if (templates.length === 0) {
    const [seeded] = await db
      .insert(coachingTemplates)
      .values({
        department: 'Production',
        name: 'Standard Production Coaching',
        objectives: [
          { id: '1', text: 'Reviewed weekly PPH and Gap % data with employee' },
          { id: '2', text: 'Employee confirmed understanding of 100 PPH standard' },
          { id: '3', text: 'Identified primary cause of below-standard performance' },
          { id: '4', text: 'Demonstrated correct workflow technique during observation' },
          { id: '5', text: 'Agreed on specific improvement actions for next week' },
        ],
        updatedByClerkId: userId,
      })
      .returning({ id: coachingTemplates.id })
    templates = seeded ? [seeded] : []
  }

  const templateId = templates[0]?.id
  if (!templateId) {
    return NextResponse.json({ error: 'Failed to resolve template' }, { status: 500 })
  }

  // Due date: CT has 24 hours
  const dueCtAt = new Date()
  dueCtAt.setUTCHours(dueCtAt.getUTCHours() + 24)

  const [assignment] = await db
    .insert(coachingAssignments)
    .values({
      candidateId,
      templateId,
      assignedByClerkId: userId,
      trainerClerkId,
      managerNotes: managerNotes ?? null,
      dueCtAt,
    })
    .returning()

  if (!assignment) {
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 })
  }

  // Back-fill assignmentId on the candidate
  await db
    .update(coachingCandidates)
    .set({ assignmentId: assignment.id })
    .where(eq(coachingCandidates.id, candidateId))

  return NextResponse.json(assignment, { status: 201 })
}
