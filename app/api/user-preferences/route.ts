import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { userPreferences, warehouses } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select({
      id: userPreferences.id,
      clerkUserId: userPreferences.clerkUserId,
      defaultWarehouseId: userPreferences.defaultWarehouseId,
      warehouse: {
        id: warehouses.id,
        name: warehouses.name,
      },
    })
    .from(userPreferences)
    .leftJoin(warehouses, eq(userPreferences.defaultWarehouseId, warehouses.id))
    .where(eq(userPreferences.clerkUserId, userId))

  return NextResponse.json(rows[0] ?? null)
}

export async function PUT(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { warehouseId } = await req.json() as { warehouseId: number }

  const result = await db
    .insert(userPreferences)
    .values({ clerkUserId: userId, defaultWarehouseId: warehouseId })
    .onConflictDoUpdate({
      target: userPreferences.clerkUserId,
      set: {
        defaultWarehouseId: warehouseId,
        updatedAt: new Date(),
      },
    })
    .returning()

  return NextResponse.json(result[0])
}
