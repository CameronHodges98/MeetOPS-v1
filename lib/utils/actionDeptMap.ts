// Maps action name (case-insensitive lowercase) → production department.
// Actions not in this map are silently skipped during import.
// Processing and Returns are intentionally excluded — their contribution is
// shown as a capacity estimate (headcount × UPH) rather than historical action counts.
const ACTION_TO_DEPT: Record<string, string> = {
  // Picking
  'scanned for pick': 'Picking',
  'scanned for singles pick': 'Picking',
  'picked multipick item': 'Picking',

  // Put Away
  'item putaway': 'Put Away',

  // Customer Service
  'appointment loaded out': 'Customer Service',
  'checked in': 'Customer Service',
  'return item received': 'Customer Service',
  'appointment created': 'Customer Service',
}

export function actionToDept(action: string): string | null {
  return ACTION_TO_DEPT[action.toLowerCase()] ?? null
}
