import type { ParsedActionLog, IngestionError } from '@/lib/ingestion/types'
import { parseCsvDate, parseEventTimestamp } from '@/lib/utils/dateUtils'

// Maps the raw CSV column headers to our internal field names.
// If the warehouse system changes a column name, update this map — not the parser logic.
const COLUMN_MAP = {
  createdAt: 'Created At',
  date: 'Date',
  hour: 'Hour',
  location: 'Location',
  paylocityId: 'Paylocity Id',
  logType: 'Log Type',
  itemId: 'Item Id',
  action: 'Action',
  program: 'Program',
  programType: 'Program Type',
  size: 'Size',
} as const

const VALID_LOG_TYPES = ['appointment', 'item', 'container'] as const
const VALID_SIZES = ['small', 'medium', 'large', 'x-large'] as const

export function parseActionLogRow(
  row: Record<string, string>,
  rowIndex: number
): { data: ParsedActionLog | null; errors: IngestionError[] } {
  const errors: IngestionError[] = []

  // --- Required fields ---
  const createdAtRaw = row[COLUMN_MAP.createdAt]?.trim()
  const paylocityIdRaw = row[COLUMN_MAP.paylocityId]?.trim()
  const actionRaw = row[COLUMN_MAP.action]?.trim()
  const logTypeRaw = row[COLUMN_MAP.logType]?.trim().toLowerCase()
  const locationRaw = row[COLUMN_MAP.location]?.trim()
  const dateRaw = row[COLUMN_MAP.date]?.trim()
  const hourRaw = row[COLUMN_MAP.hour]?.trim()

  if (!createdAtRaw) errors.push({ row: rowIndex, field: 'Created At', message: 'Missing timestamp' })
  if (!paylocityIdRaw) errors.push({ row: rowIndex, field: 'Paylocity Id', message: 'Missing Paylocity ID' })
  if (!actionRaw) errors.push({ row: rowIndex, field: 'Action', message: 'Missing action' })
  if (!logTypeRaw) errors.push({ row: rowIndex, field: 'Log Type', message: 'Missing log type' })

  if (errors.length > 0) return { data: null, errors }

  // --- Log type validation ---
  if (!VALID_LOG_TYPES.includes(logTypeRaw as typeof VALID_LOG_TYPES[number])) {
    errors.push({
      row: rowIndex,
      field: 'Log Type',
      value: logTypeRaw,
      message: `Invalid log type. Expected: ${VALID_LOG_TYPES.join(', ')}`,
    })
    return { data: null, errors }
  }

  // --- Timestamp parsing ---
  let createdAt: Date
  try {
    createdAt = parseEventTimestamp(createdAtRaw!)
  } catch {
    errors.push({ row: rowIndex, field: 'Created At', value: createdAtRaw, message: 'Unable to parse timestamp' })
    return { data: null, errors }
  }

  // --- Optional fields ---
  const sizeRaw = row[COLUMN_MAP.size]?.trim().toLowerCase()
  const size = VALID_SIZES.includes(sizeRaw as typeof VALID_SIZES[number])
    ? (sizeRaw as typeof VALID_SIZES[number])
    : undefined

  const itemIdRaw = row[COLUMN_MAP.itemId]?.trim()
  const itemId = itemIdRaw && !isNaN(Number(itemIdRaw)) ? Number(itemIdRaw) : undefined

  const programRaw = row[COLUMN_MAP.program]?.trim()
  const programTypeRaw = row[COLUMN_MAP.programType]?.trim()

  return {
    data: {
      employeePaylocityId: paylocityIdRaw!,
      createdAt,
      date: dateRaw || createdAt.toISOString().split('T')[0],
      hour: hourRaw || '',
      location: locationRaw || 'Mesa',
      logType: logTypeRaw as typeof VALID_LOG_TYPES[number],
      itemId,
      action: actionRaw!,
      program: programRaw || undefined,
      programType: programTypeRaw || undefined,
      size,
    },
    errors: [],
  }
}
