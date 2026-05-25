import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { coachingInvites } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { addDays } from 'date-fns'

// POST — create a new invite token
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = randomBytes(24).toString('hex')
  const expiresAt = addDays(new Date(), 7)   // invite valid for 7 days

  const [invite] = await db
    .insert(coachingInvites)
    .values({ token, createdByClerkId: userId, expiresAt })
    .returning()

  const baseUrl = request.nextUrl.origin
  return NextResponse.json({ token: invite.token, url: `${baseUrl}/invite/${invite.token}`, expiresAt: invite.expiresAt }, { status: 201 })
}

// GET — list recent invites (for the manager to see what's been sent)
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const invites = await db
    .select()
    .from(coachingInvites)
    .where(eq(coachingInvites.createdByClerkId, userId))
    .orderBy(desc(coachingInvites.createdAt))
    .limit(10)

  return NextResponse.json(invites)
}
