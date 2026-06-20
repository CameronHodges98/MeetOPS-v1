import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { appUsers, checklistTemplates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { AppRole } from '@/config/roles'

const MANAGER_ROLES: AppRole[] = ['root', 'gm', 'ops']

async function getManager(userId: string) {
  const [user] = await db
    .select({ role: appUsers.role, isActive: appUsers.isActive })
    .from(appUsers).where(eq(appUsers.clerkId, userId)).limit(1)
  if (!user || !user.isActive) return null
  if (!MANAGER_ROLES.includes(user.role as AppRole)) return null
  return user
}

// PATCH /api/coaching/checklists/[id] — edit a template (managers only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await getManager(userId))) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json() as {
    name?: string
    items?: { id: string; category: string; text: string }[]
    isActive?: boolean
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.items !== undefined) updates.items = body.items
  if (body.isActive !== undefined) updates.isActive = body.isActive

  const [updated] = await db.update(checklistTemplates)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set(updates as any)
    .where(eq(checklistTemplates.id, Number(id)))
    .returning()

  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(updated)
}

// DELETE /api/coaching/checklists/[id] — soft-delete (deactivate)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await getManager(userId))) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const [updated] = await db.update(checklistTemplates)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(checklistTemplates.id, Number(id)))
    .returning()

  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ success: true })
}
