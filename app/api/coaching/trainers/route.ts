import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { userProfiles, coachingAssignments } from '@/lib/db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'

const CT_CAPACITY_LIMIT = 5

// GET /api/coaching/trainers?schedule=weekday|weekend|both
// Returns trainers with their current active assignment count and available slots.
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const schedule = searchParams.get('schedule') // 'weekday' | 'weekend' | 'both' | null

  // Fetch CTs from user_profiles
  const conditions = [eq(userProfiles.role, 'ct')]
  if (schedule && schedule !== 'both') {
    conditions.push(
      inArray(userProfiles.trainerSchedule, [
        schedule as 'weekday' | 'weekend',
        'both',
      ])
    )
  }

  const trainers = await db
    .select()
    .from(userProfiles)
    .where(and(...conditions))

  if (trainers.length === 0) return NextResponse.json([])

  // Count active assignments per trainer
  const activeStatuses = ['assigned', 'in_progress', 'pending_review'] as const
  const activeCounts = await db
    .select({
      trainerClerkId: coachingAssignments.trainerClerkId,
      count: sql<number>`count(*)::int`,
    })
    .from(coachingAssignments)
    .where(
      and(
        inArray(
          coachingAssignments.trainerClerkId,
          trainers.map((t) => t.clerkId)
        ),
        inArray(coachingAssignments.status, activeStatuses as unknown as ('assigned' | 'in_progress' | 'pending_review' | 'complete')[])
      )
    )
    .groupBy(coachingAssignments.trainerClerkId)

  const countMap = new Map(activeCounts.map((r) => [r.trainerClerkId, r.count]))

  const result = trainers.map((t) => ({
    clerkId: t.clerkId,
    displayName: t.displayName,
    email: t.email,
    trainerSchedule: t.trainerSchedule,
    activeCount: countMap.get(t.clerkId) ?? 0,
    availableSlots: CT_CAPACITY_LIMIT - (countMap.get(t.clerkId) ?? 0),
  }))

  return NextResponse.json(result)
}
