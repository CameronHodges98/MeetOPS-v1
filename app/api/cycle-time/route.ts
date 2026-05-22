import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { cycleTimeFlags, employees } from '@/lib/db/schema'
import { eq, and, gte, lte, desc } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('from')
  const dateTo = searchParams.get('to')
  const employeeId = searchParams.get('employeeId')
  const minRatio = parseFloat(searchParams.get('minRatio') ?? '2.0')

  if (!dateFrom || !dateTo) {
    return NextResponse.json(
      { error: 'from and to date parameters are required' },
      { status: 400 }
    )
  }

  const conditions = [
    gte(cycleTimeFlags.date, dateFrom),
    lte(cycleTimeFlags.date, dateTo),
    gte(cycleTimeFlags.ratio, minRatio.toString()),
  ]

  if (employeeId) {
    conditions.push(eq(cycleTimeFlags.employeeId, parseInt(employeeId)))
  }

  const flags = await db
    .select({
      id: cycleTimeFlags.id,
      employeeId: cycleTimeFlags.employeeId,
      employeeName: employees.name,
      jobTitle: employees.jobTitle,
      date: cycleTimeFlags.date,
      action: cycleTimeFlags.action,
      actualSeconds: cycleTimeFlags.actualSeconds,
      standardSeconds: cycleTimeFlags.standardSeconds,
      ratio: cycleTimeFlags.ratio,
      program: cycleTimeFlags.program,
      size: cycleTimeFlags.size,
      computedAt: cycleTimeFlags.computedAt,
    })
    .from(cycleTimeFlags)
    .innerJoin(employees, eq(cycleTimeFlags.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(desc(cycleTimeFlags.ratio))
    .limit(500)

  return NextResponse.json(flags)
}
