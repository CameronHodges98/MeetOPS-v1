import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { appUsers, coachingApprovals, coachingRoster } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { AppRole } from '@/config/roles'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const [user] = await db.select({ role: appUsers.role, isActive: appUsers.isActive })
    .from(appUsers).where(eq(appUsers.clerkId, userId)).limit(1)
  if (!user || !user.isActive) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const role = user.role as AppRole
  if (!['root', 'gm', 'ops'].includes(role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pending = await db
    .select({
      approval: coachingApprovals,
      entry: coachingRoster,
    })
    .from(coachingApprovals)
    .innerJoin(coachingRoster, eq(coachingApprovals.rosterEntryId, coachingRoster.id))
    .where(eq(coachingApprovals.status, 'pending'))
    .orderBy(coachingApprovals.createdAt)

  return Response.json(pending)
}
