import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { uphStandards } from '@/lib/db/schema'

export const maxDuration = 60

const VALID_SIZES = new Set(['small', 'medium', 'large', 'x-large'])

function normalizeSize(raw: string): 'small' | 'medium' | 'large' | 'x-large' | null {
  const s = raw.trim().toLowerCase()
  if (s === 'x-large' || s === 'xlarge' || s === 'xl') return 'x-large'
  if (VALID_SIZES.has(s)) return s as 'small' | 'medium' | 'large' | 'x-large'
  return null
}

export interface UphScaleRow {
  action: string
  location: string
  itemSize: string
  programProfile: string
  secPerAction: string
  pointsPerAction: string
  uph: string
}

// POST /api/ingest/uph-scale
// Body: { rows: UphScaleRow[], replace: boolean }
// When replace=true (default), deletes all existing standards before inserting.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows, replace = true } = await request.json() as {
    rows: UphScaleRow[]
    replace?: boolean
  }

  if (!rows?.length) return Response.json({ inserted: 0 })

  const toInsert = rows
    .filter((r) => r.action?.trim() && r.uph?.trim())
    .map((r) => ({
      action: r.action.trim().toUpperCase(),
      location: r.location?.trim() || 'Mesa',
      itemSize: normalizeSize(r.itemSize ?? ''),
      programProfile: r.programProfile?.trim() || null,
      secPerAction: r.secPerAction?.trim() || '0',
      pointsPerAction: r.pointsPerAction?.trim() || '0',
      uph: Math.round(Number(r.uph)),
    }))
    .filter((r) => !isNaN(r.uph) && r.uph > 0)

  if (toInsert.length === 0) return Response.json({ inserted: 0 })

  // Replace mode: clear existing standards so re-imports don't create duplicates
  // (the unique index on nullable programProfile doesn't prevent duplicates via onConflict)
  if (replace) {
    await db.delete(uphStandards)
  }

  await db.insert(uphStandards).values(toInsert)

  return Response.json({ inserted: toInsert.length })
}
