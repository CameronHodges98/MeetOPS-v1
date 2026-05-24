// Maps action name (case-insensitive lowercase) → production department.
// Actions not in this map are silently skipped during import.
const ACTION_TO_DEPT: Record<string, string> = {
  // Picking
  'scanned for pick': 'Picking',
  'scanned for singles pick': 'Picking',
  'scanned for trash / no-sale': 'Picking',
  'picked multipick item': 'Picking',
  'lost multipick item': 'Picking',
  'mark multipick item oversize': 'Picking',
  'released from pick': 'Picking',
  'skipped singles pick item': 'Picking',
  'consolidated singles pick': 'Picking',
  'consolidated multipick item': 'Picking',
  'item lost - no recent scan': 'Picking',
  'item presort finished': 'Picking',
  'marked item as found': 'Picking',

  // Put Away
  'item putaway': 'Put Away',
  'put away multipick item': 'Put Away',
  'transshipped item put away': 'Put Away',
  'consolidation: bin relocated': 'Put Away',
  'consolidation: bin-to-bin transfer': 'Put Away',
  'container to rack putaway': 'Put Away',
  'consolidated item moved': 'Put Away',

  // Processing
  'item processing finished': 'Processing',
  'multi-item process finished': 'Processing',
  'inventoried item updated': 'Processing',
  'inventory number update': 'Processing',
  're-listed': 'Processing',

  // Customer Service (Load Out + Lot Attendant combined)
  'appointment loaded out': 'Customer Service',
  'located load out': 'Customer Service',
  'checked in': 'Customer Service',
  'return item received': 'Customer Service',
  'appointment created': 'Customer Service',
  'appointment consolidated': 'Customer Service',
  'appointment cancelled': 'Customer Service',
  'appointment time changed': 'Customer Service',
  'abandoned load out': 'Customer Service',
  'started load out': 'Customer Service',
  'marked appointment as picked up': 'Customer Service',
  'released appointment from multipick': 'Customer Service',
  'consolidated multipick appointment': 'Customer Service',
  'consolidated order moved': 'Customer Service',
  'changed parking space': 'Customer Service',
  'parking space cleared': 'Customer Service',
  'verified check in code': 'Customer Service',

  // Returns
  'return item rejected': 'Returns',
  'return item processed': 'Returns',
  'return item processed / putaway': 'Returns',
  'return item trashed': 'Returns',
}

export function actionToDept(action: string): string | null {
  return ACTION_TO_DEPT[action.toLowerCase()] ?? null
}
