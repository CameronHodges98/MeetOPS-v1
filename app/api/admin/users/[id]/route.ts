import { auth } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { appUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { AppRole } from '@/config/roles'
import { INVITABLE_ROLES } from '@/config/roles'

async function getCallerRole(userId: string): Promise<AppRole | null> {
  const [user] = await db.select({ role: appUsers.role, isActive: appUsers.isActive })
    .from(appUsers).where(eq(appUsers.clerkId, userId)).limit(1)
  if (!user || !user.isActive) return null
  return user.role as AppRole
}

// PUT /api/admin/users/[id] — update role or opsManagerClerkId
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const callerRole = await getCallerRole(userId)
  if (!callerRole || !['root', 'gm'].includes(callerRole)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json() as {
    role?: AppRole
    opsManagerClerkId?: string | null
  }

  if (body.role && !INVITABLE_ROLES.includes(body.role)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 })
  }

  const updates: Partial<typeof appUsers.$inferInsert> = {}
  if (body.role !== undefined) updates.role = body.role
  if (body.opsManagerClerkId !== undefined) updates.opsManagerClerkId = body.opsManagerClerkId

  const [updated] = await db.update(appUsers)
    .set(updates)
    .where(eq(appUsers.id, Number(id)))
    .returning()

  // Sync role to Clerk publicMetadata if role changed
  if (body.role && updated?.clerkId) {
    const client = await clerkClient()
    await client.users.updateUserMetadata(updated.clerkId, {
      publicMetadata: { role: body.role },
    })
  }

  return Response.json(updated)
}

// DELETE /api/admin/users/[id] — deactivate a user (immediate effect on next page load)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const callerRole = await getCallerRole(userId)
  if (!callerRole || !['root', 'gm'].includes(callerRole)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const [deactivated] = await db.update(appUsers)
    .set({ isActive: false })
    .where(eq(appUsers.id, Number(id)))
    .returning()

  // Clear role from Clerk metadata so their nav also clears on next token refresh
  if (deactivated?.clerkId) {
    const client = await clerkClient()
    await client.users.updateUserMetadata(deactivated.clerkId, {
      publicMetadata: { role: null },
    })
  }

  return Response.json({ success: true })
}
