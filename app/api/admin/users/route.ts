import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { appUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { AppRole } from '@/config/roles'

async function getCallerRole(userId: string): Promise<AppRole | null> {
  const [user] = await db.select({ role: appUsers.role, isActive: appUsers.isActive })
    .from(appUsers).where(eq(appUsers.clerkId, userId)).limit(1)
  if (!user || !user.isActive) return null
  return user.role as AppRole
}

// GET /api/admin/users — list all users
export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getCallerRole(userId)
  if (!role || !['root', 'gm'].includes(role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const users = await db.select().from(appUsers).orderBy(appUsers.createdAt)
  return Response.json(users)
}
