import type { ExemptEntry } from '@/app/api/shift-plan/submissions/route'
import type { ShiftPlanSubmission } from '@/lib/db/schema'

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

