import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { appUsers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const [caller] = await db.select({
    role: appUsers.role,
    isActive: appUsers.isActive,
    clerkId: appUsers.clerkId,
    opsManagerClerkId: appUsers.opsManagerClerkId,
  }).from(appUsers).where(eq(appUsers.clerkId, userId)).limit(1)

  if (!caller || !caller.isActive) return Response.json({ error: 'Forbidden' }, { status: 403 })
  // Only managers assign trainers; a CT cannot enumerate the trainer roster.
  if (caller.role === 'ct') return Response.json({ error: 'Forbidden' }, { status: 403 })

  // For AMs: return CTs whose areaManagerClerkId points to an AM under the same OM
  // For OM/GM/Root: return all active CTs
  const cts = await db.select({
    id: appUsers.id,
    clerkId: appUsers.clerkId,
    name: appUsers.name,
    email: appUsers.email,
    areaManagerClerkId: appUsers.areaManagerClerkId,
  })
    .from(appUsers)
    .where(and(eq(appUsers.role, 'ct'), eq(appUsers.isActive, true)))

  return Response.json(cts)
}
