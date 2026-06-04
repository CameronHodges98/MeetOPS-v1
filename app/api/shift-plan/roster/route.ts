import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { departmentRosters } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { APP_CONFIG } from '@/config/constants'

// PUT /api/shift-plan/roster
// Body: { department, count, dayType, location?, shiftSchedule? }
// Upserts the roster count and merges the day-type-specific shift schedule.
// shiftSchedule is stored as { weekday: ShiftEntry[], weekend: ShiftEntry[] }.
export async function PUT(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    department: string
    count: number
    dayType: 'weekday' | 'weekend'
    location?: string
    shiftSchedule?: unknown[]
  }
  const { department, count, dayType } = body
  const location = body.location ?? APP_CONFIG.DEFAULT_LOCATION

  if (!department || count == null || !dayType) {
    return Response.json({ error: 'department, count and dayType required' }, { status: 400 })
  }

  // Read the current schedule so we can merge just the affected day type
  const existing = await db.query.departmentRosters.findFirst({
    where: and(eq(departmentRosters.department, department), eq(departmentRosters.location, location)),
  })

  const prev = (existing?.shiftSchedule ?? {}) as Record<string, unknown>
  // If old data was a flat array (pre-migration), treat it as weekday
  const prevObj: Record<string, unknown> = Array.isArray(prev)
    ? { weekday: prev, weekend: [] }
    : prev

  const mergedSchedule = { ...prevObj, [dayType]: body.shiftSchedule ?? [] }

  const [row] = await db
    .insert(departmentRosters)
    .values({ department, location, count, shiftSchedule: mergedSchedule, updatedByClerkId: userId })
    .onConflictDoUpdate({
      target: [departmentRosters.department, departmentRosters.location],
      set: { count, shiftSchedule: mergedSchedule, updatedAt: new Date(), updatedByClerkId: userId },
    })
    .returning()

  return Response.json(row)
}
