import type { ParsedEmployee, IngestionError } from '@/lib/ingestion/types'

// Paylocity exports the roster as a single "Group" column with hierarchical rows.
// Each employee produces 5 rows at increasing depths:
//   " -> {paylocityId}"
//   " -> {paylocityId} -> {name}"
//   " -> {paylocityId} -> {name} -> {jobTitle}"
//   " -> {paylocityId} -> {name} -> {jobTitle} -> {location}"
//   " -> {paylocityId} -> {name} -> {jobTitle} -> {location} -> {status}"
//
// We only process the depth-5 rows (all 5 segments present) since they
// contain the complete record. Shallower rows are skipped.

const VALID_JOB_TITLES = [
  'Picker',
  'Inventory Processor',
  'Load Out',
  'Put Away',
  'Lot Attendant',
  'Returns Clerk',
  'Material Handler',
  'Area Manager',
  'Safety Coordinator',
] as const

const STATUS_MAP: Record<string, 'active' | 'inactive' | 'on_leave'> = {
  active: 'active',
  inactive: 'inactive',
  terminated: 'inactive',
  'on leave': 'on_leave',
  on_leave: 'on_leave',
  leave: 'on_leave',
}

export function parseEmployeeRow(
  row: Record<string, string>,
  rowIndex: number
): { data: ParsedEmployee | null; errors: IngestionError[] } {
  const raw = (row['Group'] ?? '').trim()

  // Split on " -> " — depth-5 row produces 6 parts: ["", id, name, title, location, status]
  const parts = raw.split(' -> ')

  // Skip rows that aren't the complete depth-5 record
  if (parts.length !== 6) return { data: null, errors: [] }

  const [, paylocityId, name, jobTitleRaw, location, statusRaw] = parts.map((p) => p.trim())

  const errors: IngestionError[] = []

  if (!paylocityId) errors.push({ row: rowIndex, field: 'Group', message: 'Missing Paylocity ID' })
  if (!name) errors.push({ row: rowIndex, field: 'Group', message: 'Missing employee name' })
  if (!jobTitleRaw) errors.push({ row: rowIndex, field: 'Group', message: 'Missing job title' })
  if (errors.length > 0) return { data: null, errors }

  const validTitle = VALID_JOB_TITLES.find(
    (t) => t.toLowerCase() === jobTitleRaw.toLowerCase()
  )
  if (!validTitle) {
    errors.push({
      row: rowIndex,
      field: 'Job Title',
      value: jobTitleRaw,
      message: `Unknown job title "${jobTitleRaw}". Expected one of: ${VALID_JOB_TITLES.join(', ')}`,
    })
    return { data: null, errors }
  }

  const status = STATUS_MAP[statusRaw?.toLowerCase()] ?? 'active'

  return {
    data: {
      paylocityId,
      name,
      jobTitle: validTitle,
      location: location || 'Mesa',
      status,
    },
    errors: [],
  }
}
