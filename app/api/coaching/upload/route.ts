import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { coachingUploads, coachingCandidates } from '@/lib/db/schema'

export interface PerformanceRow {
  managerName: string
  employeeName: string
  jobTitle: string
  pph: number
  gapPct: number
  directHours: number
  indirectHours: number
  adminHours: number
  totalHours: number
}

// GET /api/coaching/upload — list all uploads ordered by most recent
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uploads = await db
    .select()
    .from(coachingUploads)
    .orderBy(desc(coachingUploads.weekStartDate))

  return NextResponse.json(uploads)
}

// POST /api/coaching/upload
// Body: { weekStartDate: string, fileName: string, rows: PerformanceRow[] }
// Replaces any existing upload for the same week_start_date (cascade deletes candidates).
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    weekStartDate: string
    fileName: string
    rows: PerformanceRow[]
  }

  const { weekStartDate, fileName, rows } = body
  if (!weekStartDate || !fileName || !rows?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // weekEndDate = weekStartDate + 6 days
  const start = new Date(weekStartDate + 'T00:00:00Z')
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  const weekEndDate = end.toISOString().slice(0, 10)

  // Delete any existing upload for this week (candidates cascade-delete)
  const existing = await db
    .select({ id: coachingUploads.id })
    .from(coachingUploads)
    .where(eq(coachingUploads.weekStartDate, weekStartDate))

  if (existing.length > 0) {
    await db.delete(coachingUploads).where(eq(coachingUploads.weekStartDate, weekStartDate))
  }

  // Insert new upload record
  const [upload] = await db
    .insert(coachingUploads)
    .values({
      uploadedByClerkId: userId,
      fileName,
      weekStartDate,
      weekEndDate,
      candidateCount: rows.length,
    })
    .returning()

  if (!upload) {
    return NextResponse.json({ error: 'Failed to create upload record' }, { status: 500 })
  }

  if (rows.length === 0) {
    return NextResponse.json({ uploadId: upload.id, candidateCount: 0 })
  }

  // Insert candidates
  await db.insert(coachingCandidates).values(
    rows.map((r) => {
      const safeTotalHours = r.totalHours > 0 ? r.totalHours : 1
      // All pct columns stored as percentages (e.g. 15.41 = 15.41%, not 0.1541)
      // gapPct already arrives as a percentage (client multiplied by 100 before sending)
      return {
        uploadId: upload.id,
        managerName: r.managerName,
        employeeName: r.employeeName,
        jobTitle: r.jobTitle,
        avgPph: String(r.pph),
        avgGapPct: String(r.gapPct),
        avgDirectPct: String((r.directHours / safeTotalHours) * 100),
        avgIndirectPct: String((r.indirectHours / safeTotalHours) * 100),
        avgAdminPct: String((r.adminHours / safeTotalHours) * 100),
        avgHours: String(r.totalHours),
        daysInSample: 5,
        isExempt: false,
      }
    })
  )

  return NextResponse.json({ uploadId: upload.id, candidateCount: rows.length })
}
