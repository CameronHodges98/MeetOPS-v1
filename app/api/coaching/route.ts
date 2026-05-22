import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { coachingSessions, employees, trainingAssignments } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const employeeId = searchParams.get('employeeId')

  const conditions = []
  if (status) conditions.push(eq(coachingSessions.status, status as any))
  if (employeeId) conditions.push(eq(coachingSessions.employeeId, parseInt(employeeId)))

  const sessions = await db
    .select({
      id: coachingSessions.id,
      employeeId: coachingSessions.employeeId,
      employeeName: employees.name,
      status: coachingSessions.status,
      coachingDate: coachingSessions.coachingDate,
      triggerType: coachingSessions.triggerType,
      triggerValue: coachingSessions.triggerValue,
      triggerStandard: coachingSessions.triggerStandard,
      createdAt: coachingSessions.createdAt,
    })
    .from(coachingSessions)
    .innerJoin(employees, eq(coachingSessions.employeeId, employees.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(coachingSessions.createdAt))
    .limit(100)

  return NextResponse.json(sessions)
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const session = await db
    .insert(coachingSessions)
    .values({
      employeeId: body.employeeId,
      managerId: body.managerId,
      trainerId: body.trainerId,
      coachingDate: body.coachingDate,
      triggerType: body.triggerType,
      triggerValue: body.triggerValue?.toString(),
      triggerStandard: body.triggerStandard?.toString(),
      formData: body.formData,
    })
    .returning()

  return NextResponse.json(session[0], { status: 201 })
}
