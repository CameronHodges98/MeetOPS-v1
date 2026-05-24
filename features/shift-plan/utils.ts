import type { ExemptEntry } from '@/app/api/shift-plan/submissions/route'
import type { ShiftPlanSubmission } from '@/lib/db/schema'
import { SHIFT_CONFIG } from '@/config/constants'

export interface ShiftEntry {
  startTime: string  // "HH:MM" 24h format
  endTime: string    // "HH:MM" 24h format
  count: number
}

export interface DeptSnapshot {
  department: string
  scheduledCount: number
  shiftSchedule: ShiftEntry[] | null
  submission: ShiftPlanSubmission | null
}

// Total of all designated entries (producing + indirect)
export function getExemptTotal(entries: ExemptEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.count ?? 0), 0)
}

// Total of only exempt=true entries (indirect roles that don't complete dept actions)
export function getExemptOnlyTotal(entries: ExemptEntry[]): number {
  return entries.filter((e) => e.exempt).reduce((sum, e) => sum + (e.count ?? 0), 0)
}

// Production effective = scheduled − callouts + OT − indirect
// "Indirect" (exempt=true) associates are present but performing a non-production
// function. They do not count toward the dept's production capacity and cannot flex.
// Designated associates without exempt=true ARE producing and count toward capacity.
export function computeEffectiveHeadcount(snap: DeptSnapshot): number {
  const { scheduledCount, submission } = snap
  if (!submission) return scheduledCount
  const indirect = getExemptOnlyTotal((submission.exemptEntries as ExemptEntry[]) ?? [])
  return Math.max(0, scheduledCount - submission.calloutCount - indirect + submission.otCount)
}

// Total bodies on-site (including designated non-production roles).
// Used for display purposes to distinguish "present but non-production" from absent.
export function computeOnSiteHeadcount(snap: DeptSnapshot): number {
  const { scheduledCount, submission } = snap
  if (!submission) return scheduledCount
  return Math.max(0, scheduledCount - submission.calloutCount + submission.otCount)
}

// Gap = effective − needed  (positive = surplus, negative = short)
export function computeGap(effective: number, needed: number): number {
  return effective - needed
}

export function gapLabel(gap: number): string {
  if (gap > 0) return `+${gap} surplus`
  if (gap < 0) return `${gap} short`
  return 'Fully staffed'
}

export function gapStatus(gap: number): 'green' | 'amber' | 'red' {
  if (gap >= 0) return 'green'
  if (gap >= -2) return 'amber'
  return 'red'
}

// Recommended flex moves follow the facility's specific labor flex rules.
// These are suggestions only — the Operations Manager confirms or overrides all moves.
//
// Priority order:
//   Picking short        → Processing fills first
//   Customer Svc short   → Returns (max 3) → Material Handling → Picking (last resort)
//   All other deficits   → no auto-recommendation; manager adds manually
export interface RecommendedFlex {
  fromDepartment: string
  toDepartment: string
  headcountMoved: number
}

export function computeRecommendedFlexes(
  snapshots: DeptSnapshot[],
  neededByDept: Record<string, number>
): RecommendedFlex[] {
  const gapMap = new Map<string, number>()
  for (const snap of snapshots) {
    // computeEffectiveHeadcount already excludes designated non-production roles,
    // so the gap reflects true production surplus/deficit only.
    const effective = computeEffectiveHeadcount(snap)
    const needed = neededByDept[snap.department] ?? 0
    gapMap.set(snap.department, effective - needed)
  }

  const flexes: RecommendedFlex[] = []

  function tryFlex(from: string, to: string, max?: number): void {
    const surplus = gapMap.get(from) ?? 0
    const deficit = -(gapMap.get(to) ?? 0)
    if (surplus <= 0 || deficit <= 0) return
    const moved = max !== undefined ? Math.min(surplus, deficit, max) : Math.min(surplus, deficit)
    if (moved <= 0) return
    flexes.push({ fromDepartment: from, toDepartment: to, headcountMoved: moved })
    gapMap.set(from, surplus - moved)
    gapMap.set(to, (gapMap.get(to) ?? 0) + moved)
  }

  // Picking short → backfill from Processing
  tryFlex('Processing', 'Picking')

  // Customer Service short → Returns (cap 3) → Material Handling → Picking
  tryFlex('Returns', 'Customer Service', 3)
  tryFlex('Material Handling', 'Customer Service')
  tryFlex('Picking', 'Customer Service')

  // Picking surplus (after CS needs are met) → Put Away
  tryFlex('Picking', 'Put Away')

  return flexes
}

// ── Shift schedule proration ──────────────────────────────────

// Fraction of a given calendar hour (0–1) covered by a shift entry.
// e.g. a shift 5:30–14:00 covers hour 5 at 0.5, hour 6 at 1.0, hour 14 at 0.
export function getShiftFractionForHour(entry: ShiftEntry, hour: number): number {
  const [sH, sM] = entry.startTime.split(':').map(Number)
  const [eH, eM] = entry.endTime.split(':').map(Number)
  const startFrac = sH + sM / 60
  const endFrac = eH + eM / 60
  const overlap = Math.min(endFrac, hour + 1) - Math.max(startFrac, hour)
  return Math.max(0, Math.min(1, overlap))
}

// Sum of prorated scheduled headcount across all shift entries for one hour.
export function scheduledCountForHour(schedule: ShiftEntry[], hour: number): number {
  return schedule.reduce((sum, e) => sum + e.count * getShiftFractionForHour(e, hour), 0)
}

// Whether any shift entry has partial coverage of this hour (starts or ends mid-hour).
export function isHourPartial(schedule: ShiftEntry[], hour: number): boolean {
  return schedule.some((e) => {
    const frac = getShiftFractionForHour(e, hour)
    return frac > 0 && frac < 1
  })
}

// Schedule-aware quarter effective: averages prorated scheduled headcount across
// quarter hours, then scales by the overall callout ratio derived from submission data.
// Falls back to computeEffectiveHeadcount when no schedule is defined.
export function computeQuarterEffective(snap: DeptSnapshot, quarterHours: readonly number[]): number {
  const schedule = snap.shiftSchedule
  if (!schedule || schedule.length === 0) return computeEffectiveHeadcount(snap)
  const totalScheduled = snap.scheduledCount
  if (totalScheduled === 0) return 0
  const calloutRatio = computeEffectiveHeadcount(snap) / totalScheduled
  const avgProrated = quarterHours.reduce((s, h) => s + scheduledCountForHour(schedule, h), 0) / quarterHours.length
  return Math.max(0, Math.round(avgProrated * calloutRatio))
}

// Schedule-aware single-hour effective (used for per-hour capacity rows in QuarterDrawer).
// Returns a float so the caller can round after multiplying by UPH.
export function computeHourEffective(snap: DeptSnapshot, hour: number): number {
  const schedule = snap.shiftSchedule
  if (!schedule || schedule.length === 0) return computeEffectiveHeadcount(snap)
  const totalScheduled = snap.scheduledCount
  if (totalScheduled === 0) return 0
  const calloutRatio = computeEffectiveHeadcount(snap) / totalScheduled
  return Math.max(0, scheduledCountForHour(schedule, hour) * calloutRatio)
}

// Schedule-aware quarter capacity estimate.
// Sums per-hour (prorated workers × UPH × utilization) across the quarter.
export function computeQuarterCapacity(snap: DeptSnapshot, quarterHours: readonly number[], uph: number): number {
  const schedule = snap.shiftSchedule
  if (!schedule || schedule.length === 0) {
    return Math.round(computeEffectiveHeadcount(snap) * uph * quarterHours.length * SHIFT_CONFIG.UTILIZATION_FACTOR)
  }
  const totalScheduled = snap.scheduledCount
  if (totalScheduled === 0) return 0
  const calloutRatio = computeEffectiveHeadcount(snap) / totalScheduled
  const total = quarterHours.reduce((sum, h) => {
    return sum + scheduledCountForHour(schedule, h) * calloutRatio * uph * SHIFT_CONFIG.UTILIZATION_FACTOR
  }, 0)
  return Math.round(total)
}

// VTO recommendations are only generated for Q4.
// Any department still showing a surplus in the final quarter is eligible
// to be offered Voluntary Time Off — the manager decides who and how many.
export interface VtoRecommendation {
  department: string
  headcountEligible: number
}

// Processing, Returns, and MH are flex sources — surplus headcount is never offered as VTO.
const VTO_EXCLUDED_DEPTS = new Set(['Processing', 'Returns', 'Material Handling'])

export function computeVtoRecommendations(
  snapshots: DeptSnapshot[],
  neededByDept: Record<string, number>,
  quarterNum: number
): VtoRecommendation[] {
  if (quarterNum !== 4) return []

  return snapshots
    .filter((snap) => !VTO_EXCLUDED_DEPTS.has(snap.department))
    .map((snap) => ({
      department: snap.department,
      headcountEligible: computeGap(computeEffectiveHeadcount(snap), neededByDept[snap.department] ?? 0),
    }))
    .filter((r) => r.headcountEligible > 0)
}
