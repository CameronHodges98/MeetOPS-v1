import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { coachingCandidates, coachingUploads } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

// GET /api/coaching/candidates?uploadId=<id>
// Returns all candidates for a given upload, or the most recent upload if omitted.
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const uploadIdParam = searchParams.get('uploadId')

  let uploadId: number

  if (uploadIdParam) {
    uploadId = parseInt(uploadIdParam)
  } else {
    // Default to most recent upload
    const [latest] = await db
      .select({ id: coachingUploads.id })
      .from(coachingUploads)
      .orderBy(desc(coachingUploads.createdAt))
      .limit(1)

    if (!latest) return NextResponse.json([])
    uploadId = latest.id
  }

  const candidates = await db
    .select()
    .from(coachingCandidates)
    .where(eq(coachingCandidates.uploadId, uploadId))
    .orderBy(coachingCandidates.managerName, coachingCandidates.employeeName)

  return NextResponse.json(candidates)
}

// PATCH /api/coaching/candidates — toggle exempt status
export async function PATCH(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, isExempt } = body as { id: number; isExempt: boolean }

  const [updated] = await db
    .update(coachingCandidates)
    .set({
      isExempt,
      exemptedByClerkId: isExempt ? userId : null,
      exemptedAt: isExempt ? new Date() : null,
    })
    .where(eq(coachingCandidates.id, id))
    .returning()

  return NextResponse.json(updated)
}
