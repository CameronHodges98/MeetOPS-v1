import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { appUsers, invites } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { AppRole } from '@/config/roles'

async function getCallerRole(userId: string): Promise<AppRole | null> {
  const [user] = await db.select({ role: appUsers.role, isActive: appUsers.isActive })
    .from(appUsers).where(eq(appUsers.clerkId, userId)).limit(1)
  if (!user || !user.isActive) return null
  return user.role as AppRole
}

// DELETE /api/admin/invites/[id] — revoke a pending invite
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getCallerRole(userId)
  if (!role || !['root', 'gm'].includes(role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  await db.delete(invites).where(eq(invites.id, Number(id)))
  return Response.json({ success: true })
}
