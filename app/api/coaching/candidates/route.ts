import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { coachingCandidates, coachingUploads } from '@/lib/db/schema'

// GET /api/coaching/candidates?uploadId=X&supervisor=Y
// supervisor is optional; if omitted, returns all candidates for the upload.
// If uploadId is omitted, returns candidates for the most recent upload.
export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const uploadIdParam = searchParams.get('uploadId')
  const supervisorParam = searchParams.get('supervisor')?.trim().toLowerCase() ?? null

  let uploadId: number | null = uploadIdParam ? Number(uploadIdParam) : null

  // If no uploadId provided, use the most recent upload
  if (!uploadId) {
    const latest = await db
      .select({ id: coachingUploads.id })
      .from(coachingUploads)
      .orderBy(desc(coachingUploads.weekStartDate))
      .limit(1)

    if (!latest.length) return NextResponse.json({ candidates: [], upload: null })
    uploadId = latest[0].id
  }

  const upload = await db
    .select()
    .from(coachingUploads)
    .where(eq(coachingUploads.id, uploadId))
    .limit(1)

  if (!upload.length) return NextResponse.json({ error: 'Upload not found' }, { status: 404 })

  const candidates = await db
    .select()
    .from(coachingCandidates)
    .where(eq(coachingCandidates.uploadId, uploadId))

  // Filter by supervisor if provided (case-insensitive)
  const filtered = supervisorParam
    ? candidates.filter((c) => c.managerName.toLowerCase().includes(supervisorParam))
    : candidates

  // Sort by PPH ascending (lowest first — needs most attention)
  filtered.sort((a, b) => Number(a.avgPph ?? 0) - Number(b.avgPph ?? 0))

  return NextResponse.json({ candidates: filtered, upload: upload[0] })
}

// PATCH /api/coaching/candidates — exempt/unexempt a candidate (Phase 2)
export async function PATCH(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, isExempt } = await request.json() as { id: number; isExempt: boolean }
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

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
