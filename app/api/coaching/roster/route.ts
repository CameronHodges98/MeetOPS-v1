import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { appUsers, coachingRoster, coachingSessions, coachingApprovals, performanceWeeks } from '@/lib/db/schema'
import { eq, desc, inArray, and } from 'drizzle-orm'
import type { AppRole } from '@/config/roles'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const [caller] = await db
    .select({ role: appUsers.role, isActive: appUsers.isActive, name: appUsers.name, clerkId: appUsers.clerkId })
    .from(appUsers).where(eq(appUsers.clerkId, userId)).limit(1)
  if (!caller || !caller.isActive) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const role = caller.role as AppRole

  // Certified Trainers have no business on the manager disciplinary board.
  if (role === 'ct') return Response.json({ error: 'Forbidden' }, { status: 403 })

  // Determine which managerNames this caller is allowed to see
  // AM  → only employees where managerName matches their own name
  // OM  → all employees under AMs reporting to them
  // GM/Root → everyone
  let allowedManagerNames: string[] | null = null // null = no filter (see all)

  if (role === 'am') {
    if (!caller.name) return Response.json({ entries: [], weekEmployees: [], pendingApprovalsCount: 0 })
    allowedManagerNames = [caller.name]
  } else if (role === 'ops') {
    // Get all AMs reporting to this OM
    const ams = await db
      .select({ name: appUsers.name })
      .from(appUsers)
      .where(and(eq(appUsers.opsManagerClerkId, userId), eq(appUsers.isActive, true), eq(appUsers.role, 'am')))
    allowedManagerNames = ams.map((a) => a.name).filter(Boolean) as string[]
    // If the OM themselves manages employees directly, include their name too
    if (caller.name) allowedManagerNames.push(caller.name)
  }
  // gm, root → allowedManagerNames stays null (no filter)

  // Fetch roster entries scoped to allowed managers
  const entries = await db.select().from(coachingRoster)
    .where(
      allowedManagerNames !== null
        ? and(eq(coachingRoster.isActive, true), inArray(coachingRoster.managerName, allowedManagerNames))
        : eq(coachingRoster.isActive, true)
    )
    .orderBy(desc(coachingRoster.updatedAt))

  const entryIds = entries.map((e) => e.id)

  const [sessions, approvals] = await Promise.all([
    entryIds.length
      ? db.select().from(coachingSessions).where(inArray(coachingSessions.rosterEntryId, entryIds))
      : Promise.resolve([]),
    entryIds.length
      ? db.select().from(coachingApprovals).where(inArray(coachingApprovals.rosterEntryId, entryIds))
      : Promise.resolve([]),
  ])

  const pendingCount = approvals.filter((a) => a.status === 'pending').length

  const enriched = entries.map((entry) => ({
    ...entry,
    sessions: sessions.filter((s) => s.rosterEntryId === entry.id),
    approvals: approvals.filter((a) => a.rosterEntryId === entry.id),
    pendingApproval: approvals.find((a) => a.rosterEntryId === entry.id && a.status === 'pending') ?? null,
  }))

  // Latest week employees scoped to same manager filter (for roster tray)
  const [latestWeek] = await db
    .select({ weekDate: performanceWeeks.weekDate })
    .from(performanceWeeks)
    .orderBy(desc(performanceWeeks.weekDate))
    .limit(1)

  let weekEmployees: { employeeName: string; managerName: string; jobTitle: string; pph: number | null; gapPct: number | null; directPct: number | null }[] = []
  if (latestWeek) {
    weekEmployees = await db
      .select({
        employeeName: performanceWeeks.employeeName,
        managerName: performanceWeeks.managerName,
        jobTitle: performanceWeeks.jobTitle,
        pph: performanceWeeks.pph,
        gapPct: performanceWeeks.gapPct,
        directPct: performanceWeeks.directPct,
      })
      .from(performanceWeeks)
      .where(
        allowedManagerNames !== null
          ? and(eq(performanceWeeks.weekDate, latestWeek.weekDate), inArray(performanceWeeks.managerName, allowedManagerNames))
          : eq(performanceWeeks.weekDate, latestWeek.weekDate)
      )
  }

  return Response.json({ entries: enriched, weekEmployees, pendingApprovalsCount: pendingCount })
}
