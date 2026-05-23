import type { ExemptEntry } from '@/app/api/shift-plan/submissions/route'
import type { ShiftPlanSubmission } from '@/lib/db/schema'

export interface DeptSnapshot {
  department: string
  scheduledCount: number
  submission: ShiftPlanSubmission | null
}

export function getExemptTotal(entries: ExemptEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.count ?? 0), 0)
}

// Effective headcount = scheduled − callouts − exempt + OT
export function computeEffectiveHeadcount(snap: DeptSnapshot): number {
  const { scheduledCount, submission } = snap
  if (!submission) return scheduledCount
  const exempt = getExemptTotal((submission.exemptEntries as ExemptEntry[]) ?? [])
  return Math.max(0, scheduledCount - submission.calloutCount - exempt + submission.otCount)
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

// Compute recommended flexes from surplus depts to short depts.
// Largest surplus donates first, largest shortage receives first.
export interface RecommendedFlex {
  fromDepartment: string
  toDepartment: string
  headcountMoved: number
}

export function computeRecommendedFlexes(
  snapshots: DeptSnapshot[],
  neededByDept: Record<string, number>
): RecommendedFlex[] {
  const gaps = snapshots.map((s) => ({
    department: s.department,
    gap: computeGap(computeEffectiveHeadcount(s), neededByDept[s.department] ?? 0),
  }))

  const surplus = gaps.filter((g) => g.gap > 0).sort((a, b) => b.gap - a.gap)
  const short = gaps.filter((g) => g.gap < 0).sort((a, b) => a.gap - b.gap)

  const remaining = surplus.map((s) => ({ ...s }))
  const flexes: RecommendedFlex[] = []

  for (const need of short) {
    let stillNeeded = Math.abs(need.gap)
    for (const src of remaining) {
      if (stillNeeded <= 0 || src.gap <= 0) continue
      const moved = Math.min(src.gap, stillNeeded)
      flexes.push({ fromDepartment: src.department, toDepartment: need.department, headcountMoved: moved })
      src.gap -= moved
      stillNeeded -= moved
    }
  }

  return flexes
}
