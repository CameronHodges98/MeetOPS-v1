import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { coachingTemplates } from '@/lib/db/schema'

const DEFAULT_TEMPLATE = {
  department: 'Production',
  name: 'Standard Production Coaching',
  objectives: [
    { id: '1', text: 'Reviewed weekly PPH and Gap % data with employee' },
    { id: '2', text: 'Employee confirmed understanding of 100 PPH standard' },
    { id: '3', text: 'Identified primary cause of below-standard performance' },
    { id: '4', text: 'Demonstrated correct workflow technique during observation' },
    { id: '5', text: 'Agreed on specific improvement actions for next week' },
  ],
}

// GET /api/coaching/templates — list active templates; seeds default if none exist
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let templates = await db
    .select()
    .from(coachingTemplates)
    .where(eq(coachingTemplates.isActive, true))

  if (templates.length === 0) {
    const [seeded] = await db
      .insert(coachingTemplates)
      .values({ ...DEFAULT_TEMPLATE, updatedByClerkId: userId })
      .returning()
    templates = seeded ? [seeded] : []
  }

  return NextResponse.json(templates)
}

// POST /api/coaching/templates
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    department: string
    name: string
    objectives: { id: string; text: string }[]
  }

  if (!body.department || !body.name || !body.objectives?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const [template] = await db
    .insert(coachingTemplates)
    .values({ ...body, updatedByClerkId: userId })
    .returning()

  return NextResponse.json(template, { status: 201 })
}

// PATCH /api/coaching/templates — update objectives or name
export async function PATCH(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await request.json() as {
    id: number
    department?: string
    name?: string
    objectives?: { id: string; text: string }[]
    isActive?: boolean
  }

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const [updated] = await db
    .update(coachingTemplates)
    .set({ ...updates, updatedByClerkId: userId })
    .where(eq(coachingTemplates.id, id))
    .returning()

  return NextResponse.json(updated)
}
