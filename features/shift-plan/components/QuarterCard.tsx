'use client'

import { ArrowRight, Users, Zap, ChevronRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { SHIFT_CONFIG, DEPT_DEFAULT_UPH } from '@/config/constants'
import type { SHIFT_QUARTERS } from '@/config/constants'
import type { FlexPlanEntry } from '@/lib/db/schema'
import type { DeptSnapshot, RecommendedFlex, VtoRecommendation } from '../utils'
import type { HistoricalRow } from '../queries'
import { computeEffectiveHeadcount, computeGap, gapStatus } from '../utils'

type Quarter = typeof SHIFT_QUARTERS[number]

interface QuarterCardProps {
  quarter: Quarter
  snapshots: DeptSnapshot[]
  historicalRows: HistoricalRow[]
  confirmedFlexes: FlexPlanEntry[]
  recommendedFlexes: RecommendedFlex[]
  vtoRecommendations: VtoRecommendation[]
  submittedCount: number
  totalDepts: number
  isPublished: boolean
  onClick: () => void
}

const STATUS_COLORS = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red:   'bg-red-500',
}

export function QuarterCard({
  quarter,
  snapshots,
  historicalRows,
  confirmedFlexes,
  recommendedFlexes,
  vtoRecommendations,
  submittedCount,
  totalDepts,
  isPublished,
  onClick,
}: QuarterCardProps) {
  // Processing and Returns excluded — shown as capacity estimates, not historical actions
  const CAPACITY_EST_DEPTS = new Set(['Processing', 'Returns'])
  const qHistorical = historicalRows.filter((r) => r.quarter === quarter.quarter && !CAPACITY_EST_DEPTS.has(r.department))

  // Flex adjustments for this quarter
  const qFlexes    = confirmedFlexes.filter((f) => f.quarter === quarter.quarter)
  const flexInFor  = (dept: string) => qFlexes.filter((f) => f.toDepartment   === dept).reduce((s, f) => s + f.headcountMoved, 0)
  const flexOutFor = (dept: string) => qFlexes.filter((f) => f.fromDepartment === dept).reduce((s, f) => s + f.headcountMoved, 0)

  // Flex-adjusted Processing effective drives Put Away and MH needed — must match drawer logic
  const processingSnap   = snapshots.find((s) => s.department === 'Processing')
  const processingAdjEff = processingSnap
    ? computeEffectiveHeadcount(processingSnap) + flexInFor('Processing') - flexOutFor('Processing')
    : 0

  // Per-dept summary — effective is flex-adjusted so the indicator reflects actual staffing
  const deptRows = snapshots.map((snap) => {
    const hist      = qHistorical.find((r) => r.department === snap.department)
    const effective = computeEffectiveHeadcount(snap) + flexInFor(snap.department) - flexOutFor(snap.department)
    let needed = 0
    if (snap.department === 'Put Away') {
      needed = Math.ceil((processingAdjEff * SHIFT_CONFIG.PROCESSING_DEFAULT_UPH) / SHIFT_CONFIG.PUTAWAY_DEFAULT_UPH)
    } else if (snap.department === 'Material Handling') {
      needed = Math.ceil(processingAdjEff / SHIFT_CONFIG.MH_PROCESSORS_RATIO)
    } else if (!CAPACITY_EST_DEPTS.has(snap.department)) {
      needed = hist ? Number(hist.avg_headcount_needed) : 0
    }
    const gap = computeGap(effective, needed)
    return { dept: snap.department, effective, needed, gap, status: gapStatus(gap) }
  })

  // Overall quarter health: only depts with a demand target (needed > 0) drive the indicator.
  // Source depts like Processing and Returns have needed = 0 — their effective can go negative
  // after flex moves out, which should not color the card red since there's no staffing target.
  const targetedDepts = deptRows.filter((r) => r.needed > 0)
  const overallStatus = targetedDepts.some((r) => r.status === 'red')
    ? 'red'
    : targetedDepts.some((r) => r.status === 'amber')
      ? 'amber'
      : 'green'

  const totalAssigned = deptRows.reduce((s, r) => s + r.effective, 0)
  const totalNeeded   = deptRows.reduce((s, r) => s + r.needed, 0)

  // Per-dept capacity estimates: effective headcount × blended UPH × quarter hours × utilization
  const deptCapacities = snapshots
    .filter((s) => DEPT_DEFAULT_UPH[s.department] != null)
    .map((s) => {
      const uph = DEPT_DEFAULT_UPH[s.department]
      const effective = computeEffectiveHeadcount(s)
      return {
        dept: s.department,
        capacity: Math.round(effective * uph * quarter.hours.length * SHIFT_CONFIG.UTILIZATION_FACTOR),
      }
    })
    .filter((s) => s.capacity > 0)

  const qRecs = recommendedFlexes

  const allSubmitted = submittedCount >= totalDepts

  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn('h-2.5 w-2.5 rounded-full', STATUS_COLORS[overallStatus])} />
          <span className="text-sm font-bold text-foreground">{quarter.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Submission badge */}
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full border font-medium',
            allSubmitted
              ? 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
              : 'bg-muted border-border text-muted-foreground'
          )}>
            {submittedCount}/{totalDepts} submitted
          </span>
          {isPublished && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 font-medium">
              Published
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>

      {/* 3 metric rows */}
      <div className="space-y-3">
        {/* 1 — Headcount */}
        <div className="flex items-start gap-2.5">
          <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">Total assigned</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {deptRows.map((r) => (
                <span key={r.dept} className="text-xs">
                  <span className="font-medium text-foreground">{r.effective}</span>
                  <span className="text-muted-foreground"> {r.dept}</span>
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalAssigned} assigned · {totalNeeded > 0 ? `${totalNeeded} needed` : 'No demand data yet'}
            </p>
          </div>
        </div>

        {/* 2 — Flex moves */}
        <div className="flex items-start gap-2.5">
          <ArrowRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">
              Labor flex
              {qRecs.length > 0 && qFlexes.length === 0 && (
                <span className="ml-1 text-amber-500 dark:text-amber-400">(recommended)</span>
              )}
            </p>
            {qFlexes.length === 0 && qRecs.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No flex moves set</p>
            )}
            {/* Confirmed flexes */}
            {qFlexes.map((f) => (
              <p key={f.id} className="text-xs font-medium text-foreground">
                +{f.headcountMoved} {f.fromDepartment} → {f.toDepartment}
              </p>
            ))}
            {/* Recommendations (only if no confirmed flexes yet) */}
            {qFlexes.length === 0 && qRecs.map((r, i) => (
              <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
                +{r.headcountMoved} {r.fromDepartment} → {r.toDepartment}
              </p>
            ))}
          </div>
        </div>

        {/* 3 — Capacity estimate */}
        <div className="flex items-start gap-2.5">
          <Zap className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">Capacity estimate</p>
            {deptCapacities.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No headcount submitted yet</p>
            ) : (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {deptCapacities.map((s) => (
                  <span key={s.dept} className="text-xs">
                    <span className="font-medium text-foreground">~{s.capacity.toLocaleString()}</span>
                    <span className="text-muted-foreground"> {s.dept}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 4 — VTO eligibility (Q4 only) */}
        {vtoRecommendations.length > 0 && (
          <div className="flex items-start gap-2.5">
            <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">
                VTO eligible
                <span className="ml-1 text-blue-500 dark:text-blue-400">(surplus)</span>
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {vtoRecommendations.map((r) => (
                  <span key={r.department} className="text-xs text-blue-600 dark:text-blue-400">
                    {r.department}: <span className="font-medium">{r.headcountEligible}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

    </button>
  )
}
