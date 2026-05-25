import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { userProfiles, coachingAssignments } from '@/lib/db/schema'
import { and, eq, inArray, sql } from 'drizzle-orm'

// DELETE /api/coaching/trainers/[clerkId]
// Revokes CT access: clears Clerk publicMetadata role and removes user_profiles row.
// Active assignments are left in place so managers can reassign them manually.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ clerkId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clerkId } = await params

  // Count active assignments so caller can warn before confirming
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(coachingAssignments)
    .where(
      and(
        eq(coachingAssignments.trainerClerkId, clerkId),
        inArray(coachingAssignments.status, ['assigned', 'in_progress', 'pending_review'])
      )
    )

  // Revoke role in Clerk
  const client = await clerkClient()
  await client.users.updateUser(clerkId, { publicMetadata: { role: null } })

  // Remove user_profiles row
  await db.delete(userProfiles).where(eq(userProfiles.clerkId, clerkId))

  return NextResponse.json({ ok: true, activeAssignmentsUnassigned: count })
}

// GET /api/coaching/trainers/[clerkId] — fetch one CT's profile + active count
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clerkId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clerkId } = await params

  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.clerkId, clerkId))
    .limit(1)

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(coachingAssignments)
    .where(
      and(
        eq(coachingAssignments.trainerClerkId, clerkId),
        inArray(coachingAssignments.status, ['assigned', 'in_progress', 'pending_review'])
      )
    )

  return NextResponse.json({ ...profile, activeAssignments: count })
}
