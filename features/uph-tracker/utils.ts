import { SHIFT_CONFIG, PERFORMANCE_THRESHOLDS } from '@/config/constants'
import type { PerformanceStatus } from '@/lib/utils/uphCalculator'

// Raw shape returned by /api/uph — numeric columns come back as strings from Postgres
export interface UphApiRow {
  employeeId: number
  employeeName: string
  jobTitle: string
  paylocityId: string
  totalPoints: string | number
  totalActions: string | number
  daysWorked: string | number
  standardHours: string | number
}

// Derived shape used by UI components
export interface UphRow {
  employeeId: number
  employeeName: string
  jobTitle: string
  paylocityId: string
  totalPoints: number
  totalActions: number
  daysWorked: number
  // Estimated actual hours = daysWorked * default shift length
  estimatedHours: number
  // Time employee would spend if working at standard speed on their action mix
  standardHours: number
  pph: number
  // Ratio of standard hours to actual hours — 1.0 = exactly on standard
  efficiencyPct: number
  status: PerformanceStatus
}

export function computeUphRow(raw: UphApiRow): UphRow {
  const totalPoints = Number(raw.totalPoints)
  const totalActions = Number(raw.totalActions)
  const daysWorked = Number(raw.daysWorked)
  const standardHours = Number(raw.standardHours)

  const estimatedHours = daysWorked * SHIFT_CONFIG.DEFAULT_SHIFT_HOURS
  const pph = estimatedHours > 0 ? Math.round(totalPoints / estimatedHours) : 0

  // efficiencyPct: what fraction of standard work volume the employee completed
  // relative to their shift hours.  > 100% means above standard.
  const efficiencyPct =
    estimatedHours > 0 ? Math.round((standardHours / estimatedHours) * 100) : 0

  let status: PerformanceStatus = 'insufficient_data'
  if (estimatedHours >= PERFORMANCE_THRESHOLDS.MIN_HOURS_FOR_PPH) {
    if (efficiencyPct >= PERFORMANCE_THRESHOLDS.ON_TARGET_PERCENT) status = 'on_target'
    else if (efficiencyPct >= PERFORMANCE_THRESHOLDS.WATCH_PERCENT) status = 'watch'
    else status = 'needs_attention'
  }

  return {
    employeeId: Number(raw.employeeId),
    employeeName: raw.employeeName,
    jobTitle: raw.jobTitle,
    paylocityId: raw.paylocityId,
    totalPoints,
    totalActions,
    daysWorked,
    estimatedHours,
    standardHours,
    pph,
    efficiencyPct,
    status,
  }
}

export function summarizeUphRows(rows: UphRow[]) {
  const withData = rows.filter((r) => r.status !== 'insufficient_data')
  const avgPph =
    withData.length > 0
      ? Math.round(withData.reduce((s, r) => s + r.pph, 0) / withData.length)
      : 0

  return {
    totalEmployees: rows.length,
    avgPph,
    onTargetCount: rows.filter((r) => r.status === 'on_target').length,
    watchCount: rows.filter((r) => r.status === 'watch').length,
    needsAttentionCount: rows.filter((r) => r.status === 'needs_attention').length,
  }
}
