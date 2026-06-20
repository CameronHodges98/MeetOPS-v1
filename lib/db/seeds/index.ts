/**
 * Seed script — `npm run db:seed`
 *
 * Idempotent. Inserts the default coaching observation checklist templates
 * a Certified Trainer fills out during a coaching session. Checklists are
 * universal — any CT can pick any one for any employee. Re-running updates the
 * items of a template with the same name.
 */
import { db } from '../index'
import { checklistTemplates } from '../schema'
import { eq } from 'drizzle-orm'

const SEED_CLERK_ID = 'system-seed'

type SeedItem = { id: string; category: string; text: string }
type SeedTemplate = { name: string; items: SeedItem[] }

const TEMPLATES: SeedTemplate[] = [
  {
    name: 'General Coaching Observation',
    items: [
      { id: 'gen-1', category: 'Engagement', text: 'Arrived at station on time and ready to work' },
      { id: 'gen-2', category: 'Engagement', text: 'Stayed in direct (productive) work for the observation window' },
      { id: 'gen-3', category: 'Process', text: 'Follows the standard work steps for their role' },
      { id: 'gen-4', category: 'Process', text: 'Uses the scanner / system correctly without workarounds' },
      { id: 'gen-5', category: 'Quality', text: 'Work meets quality standard (no rework or errors observed)' },
      { id: 'gen-6', category: 'Safety', text: 'Follows safety expectations (lifting, lanes, equipment)' },
      { id: 'gen-7', category: 'Coachability', text: 'Receptive to feedback and willing to adjust' },
    ],
  },
  {
    name: 'Picker Observation',
    items: [
      { id: 'pick-1', category: 'Process', text: 'Scans for pick before moving to the item' },
      { id: 'pick-2', category: 'Process', text: 'Takes an efficient travel path between picks' },
      { id: 'pick-3', category: 'Process', text: 'Batches multi-picks instead of single trips when possible' },
      { id: 'pick-4', category: 'Quality', text: 'Confirms item matches the pick (no mispicks)' },
      { id: 'pick-5', category: 'Engagement', text: 'Minimal idle/indirect time between picks' },
      { id: 'pick-6', category: 'Safety', text: 'Cart loaded safely and aisles kept clear' },
    ],
  },
  {
    name: 'Inventory Processor Observation',
    items: [
      { id: 'proc-1', category: 'Process', text: 'Grades and categorizes items per the standard' },
      { id: 'proc-2', category: 'Process', text: 'Photographs / lists items correctly the first time' },
      { id: 'proc-3', category: 'Quality', text: 'Item condition notes are accurate and complete' },
      { id: 'proc-4', category: 'Engagement', text: 'Keeps a steady processing cadence (no long stalls)' },
      { id: 'proc-5', category: 'Process', text: 'Routes finished items to the correct downstream lane' },
      { id: 'proc-6', category: 'Safety', text: 'Workstation kept organized and safe' },
    ],
  },
]

async function seedChecklistTemplates() {
  for (const t of TEMPLATES) {
    const existing = await db
      .select({ id: checklistTemplates.id })
      .from(checklistTemplates)
      .where(eq(checklistTemplates.name, t.name))
      .limit(1)

    if (existing[0]) {
      await db
        .update(checklistTemplates)
        .set({ items: t.items, isActive: true, updatedAt: new Date() })
        .where(eq(checklistTemplates.id, existing[0].id))
      console.log(`  ↻ updated "${t.name}"`)
    } else {
      await db.insert(checklistTemplates).values({
        name: t.name,
        items: t.items,
        createdByClerkId: SEED_CLERK_ID,
      })
      console.log(`  + inserted "${t.name}"`)
    }
  }
}

async function main() {
  console.log('Seeding checklist templates…')
  await seedChecklistTemplates()
  console.log('Done.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
