import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { appUsers, checklistTemplates } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import type { AppRole } from '@/config/roles'

const MANAGER_ROLES: AppRole[] = ['root', 'gm', 'ops']

async function getCaller(userId: string) {
  const [user] = await db
    .select({ role: appUsers.role, isActive: appUsers.isActive })
    .from(appUsers).where(eq(appUsers.clerkId, userId)).limit(1)
  if (!user || !user.isActive) return null
  return user
}

// GET /api/coaching/checklists
// Any active user may read templates (CTs need them to run a session).
// Checklists are universal — every active template is returned for everyone.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await getCaller(userId)
  if (!caller) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const rows = await db
    .select().from(checklistTemplates)
    .where(eq(checklistTemplates.isActive, true))
    .orderBy(desc(checklistTemplates.updatedAt))

  return Response.json(rows)
}

// POST /api/coaching/checklists — create a template (managers only)
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await getCaller(userId)
  if (!caller || !MANAGER_ROLES.includes(caller.role as AppRole)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json() as {
    name?: string
    items?: { id: string; category: string; text: string }[]
  }

  if (!body.name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })

  const [created] = await db.insert(checklistTemplates).values({
    name: body.name.trim(),
    items: body.items ?? [],
    createdByClerkId: userId,
  }).returning()

  return Response.json(created)
}
