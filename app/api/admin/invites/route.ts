import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { appUsers, invites } from '@/lib/db/schema'
import { eq, desc, isNull } from 'drizzle-orm'
import { INVITABLE_ROLES, type AppRole } from '@/config/roles'
import crypto from 'crypto'

async function getCallerRole(userId: string): Promise<AppRole | null> {
  const [user] = await db.select({ role: appUsers.role, isActive: appUsers.isActive })
    .from(appUsers)
    .where(eq(appUsers.clerkId, userId))
    .limit(1)
  if (!user || !user.isActive) return null
  return user.role as AppRole
}

// GET /api/admin/invites — list all pending (unused, unexpired) invites
export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getCallerRole(userId)
  if (!role || !['root', 'gm'].includes(role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await db.select().from(invites)
    .where(isNull(invites.usedAt))
    .orderBy(desc(invites.createdAt))

  return Response.json(rows)
}

// POST /api/admin/invites — create an invite
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getCallerRole(userId)
  if (!role || !['root', 'gm'].includes(role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json() as { email: string; role: AppRole }
  const { email, role: inviteRole } = body

  if (!email || !inviteRole) {
    return Response.json({ error: 'email and role are required' }, { status: 400 })
  }
  if (!INVITABLE_ROLES.includes(inviteRole)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 })
  }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 36 * 60 * 60 * 1000) // 36 hours

  const [invite] = await db.insert(invites).values({
    token,
    email: email.toLowerCase().trim(),
    role: inviteRole,
    createdByClerkId: userId,
    expiresAt,
  }).returning()

  return Response.json(invite)
}
