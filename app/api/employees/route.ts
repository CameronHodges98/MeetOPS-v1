import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { employees } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { APP_CONFIG } from '@/config/constants'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const location = searchParams.get('location') ?? APP_CONFIG.DEFAULT_LOCATION
  const status = searchParams.get('status') ?? 'active'
  const jobTitle = searchParams.get('jobTitle')

  const conditions = [
    eq(employees.location, location),
    eq(employees.status, status as 'active' | 'inactive' | 'on_leave'),
  ]

  if (jobTitle) {
    conditions.push(eq(employees.jobTitle, jobTitle as any))
  }

  const result = await db
    .select()
    .from(employees)
    .where(and(...conditions))
    .orderBy(employees.name)

  return NextResponse.json(result)
}
