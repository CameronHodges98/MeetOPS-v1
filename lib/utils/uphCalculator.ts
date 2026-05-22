import type { UphStandard } from '@/lib/db/schema'
import { PERFORMANCE_THRESHOLDS } from '@/config/constants'

// ============================================================
// Standard Lookup
// ============================================================

/**
 * Finds the UPH standard for a given action + size + program combination.
 * Returns undefined if no matching standard exists (action not in scale).
 *
 * Why this matters: an action without a standard doesn't earn points.
 * These are system/admin events (Inventory Number Update, etc.) that
 * shouldn't inflate or deflate PPH calculations.
 */
export function findStandard(
  standards: UphStandard[],
  action: string,
  size?: string | null,
  programProfile?: string | null
): UphStandard | undefined {
  // Normalize to uppercase for case-insensitive matching
  const normalizedAction = action.toUpperCase()
  const normalizedSize = size?.toUpperCase() ?? null
  const normalizedProgram = programProfile?.toUpperCase() ?? null

  return standards.find((s) => {
    const actionMatch = s.action.toUpperCase() === normalizedAction
    const sizeMatch = s.itemSize === null || s.itemSize?.toUpperCase() === normalizedSize
    const programMatch =
      s.programProfile === null ||
      s.programProfile?.toUpperCase() === normalizedProgram
    return actionMatch && sizeMatch && programMatch
  })
}

// ============================================================
// Points Calculation
// ============================================================

/**
 * Returns the point value for a single action event.
 * Returns 0 if no standard matches (non-point-generating action).
 */
export function calcActionPoints(
  standards: UphStandard[],
  action: string,
  size?: string | null,
  programProfile?: string | null
): number {
  const standard = findStandard(standards, action, size, programProfile)
  if (!standard) return 0
  return parseFloat(standard.pointsPerAction.toString())
}

// ============================================================
// PPH Calculation
// ============================================================

/**
 * Calculates Points Per Hour given a total point sum and hours worked.
 * Returns 0 if hours is below the minimum threshold to prevent
 * short-shift artifacts from polluting performance data.
 */
export function calcPPH(totalPoints: number, hoursWorked: number, minHours: number = PERFORMANCE_THRESHOLDS.MIN_HOURS_FOR_PPH): number {
  if (hoursWorked < minHours) return 0
  return Math.round(totalPoints / hoursWorked)
}

// ============================================================
// Gap % Calculation
// ============================================================

/**
 * Calculates how far an employee's PPH is below the standard.
 * A positive gap means below standard (room to improve).
 * A negative gap means above standard (performing above expectations).
 *
 * Formula: ((standard - actual) / standard) * 100
 * Example: standard=117, actual=103 → gap = 11.97%
 */
export function calcGapPercent(actualPPH: number, standardPPH: number): number {
  if (standardPPH <= 0) return 0
  return ((standardPPH - actualPPH) / standardPPH) * 100
}

// ============================================================
// Performance Status
// ============================================================

export type PerformanceStatus = 'on_target' | 'watch' | 'needs_attention' | 'insufficient_data'

/**
 * Maps a PPH value against standard thresholds to a status label.
 * Status drives badge colors and coaching trigger logic throughout the app.
 */
export function getPerformanceStatus(
  actualPPH: number,
  standardPPH: number,
  hoursWorked: number
): PerformanceStatus {
  if (hoursWorked < PERFORMANCE_THRESHOLDS.MIN_HOURS_FOR_PPH) {
    return 'insufficient_data'
  }

  if (standardPPH <= 0) return 'insufficient_data'

  const percent = (actualPPH / standardPPH) * 100

  if (percent >= PERFORMANCE_THRESHOLDS.ON_TARGET_PERCENT) return 'on_target'
  if (percent >= PERFORMANCE_THRESHOLDS.WATCH_PERCENT) return 'watch'
  return 'needs_attention'
}

/**
 * Returns true if this employee's performance should trigger a coaching suggestion.
 */
export function shouldTriggerCoaching(
  actualPPH: number,
  standardPPH: number,
  hoursWorked: number
): boolean {
  if (hoursWorked < PERFORMANCE_THRESHOLDS.MIN_HOURS_FOR_PPH) return false
  if (standardPPH <= 0) return false
  const percent = (actualPPH / standardPPH) * 100
  return percent < PERFORMANCE_THRESHOLDS.COACHING_TRIGGER_PERCENT
}

// ============================================================
// Aggregate Helpers
// ============================================================

/**
 * Aggregates PPH across a group of employees for a given time window.
 * Used by the shift planner and UPH tracker rollup views.
 */
export function aggregateGroupPPH(
  employees: Array<{ totalPoints: number; hoursWorked: number }>
): number {
  const totalPoints = employees.reduce((sum, e) => sum + e.totalPoints, 0)
  const totalHours = employees.reduce((sum, e) => sum + e.hoursWorked, 0)
  return calcPPH(totalPoints, totalHours, 0) // No min-hours floor for group aggregates
}
