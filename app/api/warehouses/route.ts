import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { warehouses } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Auto-seed Mesa on first call if no warehouses exist
  const existing = await db.select().from(warehouses).where(eq(warehouses.isActive, true))

  if (existing.length === 0) {
    const seeded = await db
      .insert(warehouses)
      .values({ name: 'Mesa' })
      .returning()
    return NextResponse.json(seeded)
  }

  return NextResponse.json(existing)
}

export async function POST() {
  // Admin-gated — permissions system not yet built
  return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
}
