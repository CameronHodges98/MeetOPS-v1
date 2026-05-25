import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { coachingInvites, userProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// GET — validate a token (public — no auth required)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const [invite] = await db
    .select()
    .from(coachingInvites)
    .where(eq(coachingInvites.token, token))
    .limit(1)

  if (!invite) return NextResponse.json({ valid: false, reason: 'not_found' })
  if (invite.usedAt) return NextResponse.json({ valid: false, reason: 'already_used' })
  if (new Date() > new Date(invite.expiresAt)) return NextResponse.json({ valid: false, reason: 'expired' })

  return NextResponse.json({ valid: true })
}

// POST — accept an invite (requires the accepting user to be signed in)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await params
  const body = await request.json() as { displayName?: string; trainerSchedule?: 'weekday' | 'weekend' | 'both' }

  const [invite] = await db
    .select()
    .from(coachingInvites)
    .where(eq(coachingInvites.token, token))
    .limit(1)

  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (invite.usedAt) return NextResponse.json({ error: 'Invite already used' }, { status: 410 })
  if (new Date() > new Date(invite.expiresAt)) return NextResponse.json({ error: 'Invite expired' }, { status: 410 })

  // Set role=ct in Clerk publicMetadata so middleware bypass activates immediately
  const client = await clerkClient()
  await client.users.updateUser(userId, {
    publicMetadata: { role: 'ct' },
  })

  // Get email from Clerk to store in user_profiles
  const clerkUser = await client.users.getUser(userId)
  const primaryEmail = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId
  )?.emailAddress

  // Upsert user_profiles record
  await db
    .insert(userProfiles)
    .values({
      clerkId: userId,
      role: 'ct',
      displayName: body.displayName ?? clerkUser.fullName ?? clerkUser.firstName ?? 'CT',
      email: primaryEmail,
      trainerSchedule: body.trainerSchedule ?? 'both',
    })
    .onConflictDoUpdate({
      target: userProfiles.clerkId,
      set: {
        role: 'ct',
        displayName: body.displayName ?? clerkUser.fullName ?? clerkUser.firstName ?? 'CT',
        email: primaryEmail,
        trainerSchedule: body.trainerSchedule ?? 'both',
      },
    })

  // Mark invite as used
  await db
    .update(coachingInvites)
    .set({ usedAt: new Date(), usedByClerkId: userId })
    .where(eq(coachingInvites.token, token))

  return NextResponse.json({ ok: true })
}
