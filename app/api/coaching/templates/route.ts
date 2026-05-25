import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { coachingTemplates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const department = searchParams.get('department')

  const conditions = [eq(coachingTemplates.isActive, true)]
  if (department) conditions.push(eq(coachingTemplates.department, department))

  const templates = await db
    .select()
    .from(coachingTemplates)
    .where(and(...conditions))
    .orderBy(coachingTemplates.department, coachingTemplates.name)

  return NextResponse.json(templates)
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const [template] = await db
    .insert(coachingTemplates)
    .values({
      department: body.department,
      name: body.name,
      objectives: body.objectives ?? [],
      updatedByClerkId: userId,
    })
    .returning()

  return NextResponse.json(template, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, ...fields } = body as {
    id: number
    name?: string
    department?: string
    objectives?: unknown[]
    isActive?: boolean
  }

  const [updated] = await db
    .update(coachingTemplates)
    .set({ ...fields, updatedByClerkId: userId })
    .where(eq(coachingTemplates.id, id))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = parseInt(searchParams.get('id') ?? '0')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Soft delete — set isActive = false
  await db
    .update(coachingTemplates)
    .set({ isActive: false, updatedByClerkId: userId })
    .where(eq(coachingTemplates.id, id))

  return NextResponse.json({ ok: true })
}
