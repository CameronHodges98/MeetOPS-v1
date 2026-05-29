import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema'

// GET /api/coaching/trainers — list all active CTs
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const trainers = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.role, 'ct'))
    .orderBy(userProfiles.displayName)

  return NextResponse.json(trainers)
}
