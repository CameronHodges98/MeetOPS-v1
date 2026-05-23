import type { ParsedEmployee, IngestionError } from '@/lib/ingestion/types'

// Paylocity export column names — update here if the export format changes
const COLUMN_MAP = {
  paylocityId: 'Paylocity Id',
  name: 'Employee Name',
  jobTitle: 'Job Title',
  location: 'Location',
  status: 'Status',
  cargoId: 'Cargo Id',
} as const

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
  const errors: IngestionError[] = []

  const paylocityId = row[COLUMN_MAP.paylocityId]?.trim()
  const name = row[COLUMN_MAP.name]?.trim()
  const jobTitleRaw = row[COLUMN_MAP.jobTitle]?.trim()

  if (!paylocityId) errors.push({ row: rowIndex, field: 'Paylocity Id', message: 'Missing Paylocity ID' })
  if (!name) errors.push({ row: rowIndex, field: 'Employee Name', message: 'Missing employee name' })
  if (!jobTitleRaw) errors.push({ row: rowIndex, field: 'Job Title', message: 'Missing job title' })

  if (errors.length > 0) return { data: null, errors }

  // Job title must exactly match one of the enum values
  const validTitle = VALID_JOB_TITLES.find(
    (t) => t.toLowerCase() === jobTitleRaw!.toLowerCase()
  )
  if (!validTitle) {
    errors.push({
      row: rowIndex,
      field: 'Job Title',
      value: jobTitleRaw,
      message: `Unknown job title. Expected one of: ${VALID_JOB_TITLES.join(', ')}`,
    })
    return { data: null, errors }
  }

  const statusRaw = row[COLUMN_MAP.status]?.trim().toLowerCase()
  const status = STATUS_MAP[statusRaw] ?? 'active'

  const cargoIdRaw = row[COLUMN_MAP.cargoId]?.trim()
  const cargoId = cargoIdRaw && !isNaN(Number(cargoIdRaw)) ? Number(cargoIdRaw) : undefined

  const location = row[COLUMN_MAP.location]?.trim() || 'Mesa'

  return {
    data: {
      paylocityId: paylocityId!,
      name: name!,
      jobTitle: validTitle,
      location,
      status,
      cargoId,
    },
    errors: [],
  }
}
