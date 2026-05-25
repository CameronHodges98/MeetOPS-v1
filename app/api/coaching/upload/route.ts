import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { coachingUploads, coachingCandidates } from '@/lib/db/schema'
import { parseCoachingCsv, filterCandidates } from '@/lib/ingestion/csv/parsers/coachingCsv'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { desc } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Optional week start date supplied by the uploader (yyyy-MM-dd).
  // Defaults to the Monday of the current week.
  const weekStartParam = formData.get('weekStart')?.toString()
  const today = new Date()
  const weekStart = weekStartParam
    ? weekStartParam
    : format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(
    endOfWeek(weekStartParam ? new Date(weekStartParam + 'T12:00:00') : today, { weekStartsOn: 1 }),
    'yyyy-MM-dd'
  )

  const csvText = await (file as File).text()
  const fileName = (file as File).name

  const rows = parseCoachingCsv(csvText)
  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'No production-role employee rows found in CSV. Check that the file matches the expected format.' },
      { status: 400 }
    )
  }

  const candidates = filterCandidates(rows)

  // Insert upload record
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

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uploads = await db
    .select()
    .from(coachingUploads)
    .orderBy(desc(coachingUploads.createdAt))
    .limit(20)

  return NextResponse.json(uploads)
}
