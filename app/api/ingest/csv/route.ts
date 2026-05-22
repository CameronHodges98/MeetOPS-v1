import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { ingestCsv, type CsvFileType } from '@/lib/ingestion/csv'

export async function POST(request: NextRequest) {
  // Clerk auth check — only authenticated managers can ingest data
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const fileType = formData.get('fileType') as CsvFileType | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!fileType) {
      return NextResponse.json(
        { error: 'fileType is required. Valid values: action_logs, uph_standards, appointments, throughput, employees' },
        { status: 400 }
      )
    }

    // Read file content as text
    const csvText = await file.text()

    if (!csvText.trim()) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    }

    const result = await ingestCsv(csvText, fileType)

    return NextResponse.json(result, {
      status: result.success ? 200 : 207, // 207 = partial success
    })
  } catch (error) {
    console.error('[CSV Ingest Error]', error)
    return NextResponse.json(
      { error: 'Ingestion failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
