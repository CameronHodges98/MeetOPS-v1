import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { departmentRosters } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { APP_CONFIG } from '@/config/constants'

// PUT /api/shift-plan/roster
// Body: { department, count, location? }
// Upserts the persistent roster count for a department.
export async function PUT(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { department: string; count: number; location?: string }
  const { department, count } = body
  const location = body.location ?? APP_CONFIG.DEFAULT_LOCATION

  if (!department || count == null) {
    return Response.json({ error: 'department and count required' }, { status: 400 })
  }

  const [row] = await db
    .insert(departmentRosters)
    .values({ department, location, count, updatedByClerkId: userId })
    .onConflictDoUpdate({
      target: [departmentRosters.department, departmentRosters.location],
      set: { count, updatedAt: new Date(), updatedByClerkId: userId },
    })
    .returning()

  return Response.json(row)
}
