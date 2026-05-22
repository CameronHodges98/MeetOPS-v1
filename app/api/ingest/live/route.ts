import { NextRequest, NextResponse } from 'next/server'

/**
 * Live feed ingestion endpoint — STUB
 *
 * This will be activated when DATA_SOURCE=live is set.
 * The warehouse system will POST event payloads to this endpoint,
 * or a scheduled job will call GET to trigger a sync poll.
 *
 * See lib/ingestion/live/index.ts for implementation notes.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Live feed ingestion is not yet configured. Current mode: CSV upload.' },
    { status: 503 }
  )
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { status: 'Live feed ingestion is not yet configured. Current mode: CSV upload.' },
    { status: 503 }
  )
}
