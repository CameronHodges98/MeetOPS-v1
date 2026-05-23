import type { ParsedUphStandard, IngestionError } from '@/lib/ingestion/types'

// Column names from UPH_scale.csv
const COLUMN_MAP = {
  action: 'ACTION',
  location: 'LOCATION',
  itemSize: 'ITEM SIZE',
  programProfile: 'PROGRAM PROFILE',
  secPerAction: 'SEC / ACTION',
  pointsPerAction: 'POINTS / ACTION',
  uph: 'ACTIONS / HOUR',
} as const

export function parseUphStandardRow(
  row: Record<string, string>,
  rowIndex: number
): { data: ParsedUphStandard | null; errors: IngestionError[] } {
  const errors: IngestionError[] = []

  const action = row[COLUMN_MAP.action]?.trim()
  const location = row[COLUMN_MAP.location]?.trim()
  const secPerActionRaw = row[COLUMN_MAP.secPerAction]?.trim()
  const pointsPerActionRaw = row[COLUMN_MAP.pointsPerAction]?.trim()
  const uphRaw = row[COLUMN_MAP.uph]?.trim()

  if (!action) errors.push({ row: rowIndex, field: 'ACTION', message: 'Missing action name' })
  if (!secPerActionRaw || isNaN(Number(secPerActionRaw)))
    errors.push({ row: rowIndex, field: 'SEC / ACTION', value: secPerActionRaw, message: 'Invalid seconds value' })
  if (!pointsPerActionRaw || isNaN(Number(pointsPerActionRaw)))
    errors.push({ row: rowIndex, field: 'POINTS / ACTION', value: pointsPerActionRaw, message: 'Invalid points value' })
  if (!uphRaw || isNaN(Number(uphRaw)))
    errors.push({ row: rowIndex, field: 'ACTIONS / HOUR', value: uphRaw, message: 'Invalid UPH value' })

  if (errors.length > 0) return { data: null, errors }

  const itemSizeRaw = row[COLUMN_MAP.itemSize]?.trim()
  const programProfileRaw = row[COLUMN_MAP.programProfile]?.trim()

  return {
    data: {
      action: action!,
      location: location || 'MESA',
      itemSize: itemSizeRaw || undefined,
      programProfile: programProfileRaw || undefined,
      secPerAction: Number(secPerActionRaw),
      pointsPerAction: Number(pointsPerActionRaw),
      uph: Number(uphRaw),
    },
    errors: [],
  }
}
