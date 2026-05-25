import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { coachingUploads, coachingCandidates } from '@/lib/db/schema'
import {
  parseCoachingCsv,
  aggregateAndFilterCandidates,
  getWeekBounds,
} from '@/lib/ingestion/csv/parsers/coachingCsv'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const csvText = await (file as File).text()
  const fileName = (file as File).name

  const rows = parseCoachingCsv(csvText)
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No employee rows found in CSV' }, { status: 400 })
  }

  const { weekStart, weekEnd } = getWeekBounds(rows)
  const candidates = aggregateAndFilterCandidates(rows)

  // Insert upload record first
  const [upload] = await db
    .insert(coachingUploads)
    .values({
      uploadedByClerkId: userId,
      fileName,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      candidateCount: candidates.length,
    })
    .returning()

  // Bulk insert candidates
  if (candidates.length > 0) {
    await db.insert(coachingCandidates).values(
      candidates.map((c) => ({
        uploadId: upload.id,
        managerName: c.managerName,
        employeeName: c.employeeName,
        jobTitle: c.jobTitle,
        avgPph: c.avgPph.toString(),
        avgGapPct: c.avgGapPct.toString(),
        avgDirectPct: c.avgDirectPct.toString(),
        avgIndirectPct: c.avgIndirectPct.toString(),
        avgAdminPct: c.avgAdminPct.toString(),
        avgHours: c.avgHours.toString(),
        daysInSample: c.daysInSample,
      }))
    )
  }

  return NextResponse.json(
    { uploadId: upload.id, candidateCount: candidates.length, weekStart, weekEnd },
    { status: 201 }
  )
}

// GET: list recent uploads
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uploads = await db
    .select()
    .from(coachingUploads)
    .orderBy(coachingUploads.createdAt)
    .limit(20)

  return NextResponse.json(uploads)
}
