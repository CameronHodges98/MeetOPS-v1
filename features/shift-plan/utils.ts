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
