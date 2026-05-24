'use client'

import { ArrowRight, Users, Zap, TrendingUp, ChevronRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { SHIFT_CONFIG } from '@/config/constants'
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

  // Per-dept summary
  const deptRows = snapshots.map((snap) => {
    const hist = qHistorical.find((r) => r.department === snap.department)
    const effective = computeEffectiveHeadcount(snap)
    const needed = hist ? Number(hist.avg_headcount_needed) : 0
    const gap = computeGap(effective, needed)
    return { dept: snap.department, effective, needed, gap, status: gapStatus(gap) }
  })

  // Overall quarter health: worst status wins
  const overallStatus = deptRows.some((r) => r.status === 'red')
    ? 'red'
    : deptRows.some((r) => r.status === 'amber')
      ? 'amber'
      : 'green'

  const totalAssigned = deptRows.reduce((s, r) => s + r.effective, 0)
  const totalNeeded   = deptRows.reduce((s, r) => s + r.needed, 0)
  const totalActions  = qHistorical.reduce((s, r) => s + Number(r.avg_total_actions), 0)
  const dataPoints    = qHistorical.length > 0
    ? Math.min(...qHistorical.map((r) => Number(r.data_points)))
    : 0

  // Capacity estimates for depts not tracked via historical actions
  const processingSnap = snapshots.find((s) => s.department === 'Processing')
  const processingEffective = processingSnap ? computeEffectiveHeadcount(processingSnap) : 0
  const processingCapacity = Math.round(
    processingEffective * SHIFT_CONFIG.PROCESSING_DEFAULT_UPH * quarter.hours.length * SHIFT_CONFIG.UTILIZATION_FACTOR
  )
  const returnsSnap = snapshots.find((s) => s.department === 'Returns')
  const returnsEffective = returnsSnap ? computeEffectiveHeadcount(returnsSnap) : 0
  const returnsCapacity = Math.round(
    returnsEffective * SHIFT_CONFIG.RETURNS_DEFAULT_UPH * quarter.hours.length * SHIFT_CONFIG.UTILIZATION_FACTOR
  )

  const qFlexes = confirmedFlexes.filter((f) => f.quarter === quarter.quarter)
  const qRecs   = recommendedFlexes

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

        {/* 3 — Predicted actions */}
        <div className="flex items-start gap-2.5">
          <Zap className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">
              Predicted actions
              {dataPoints > 0 && dataPoints < 6 && (
                <span className="ml-1 text-amber-500 dark:text-amber-400">({dataPoints}/6 weeks)</span>
              )}
              {dataPoints >= 6 && (
                <span className="ml-1 text-green-600 dark:text-green-400">(6 weeks)</span>
              )}
            </p>
            {totalActions === 0 && processingCapacity === 0 && returnsCapacity === 0 ? (
              <p className="text-xs text-muted-foreground italic">No historical data yet</p>
            ) : (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {qHistorical.map((r) => (
                  <span key={r.department} className="text-xs">
                    <span className="font-medium text-foreground">
                      {Number(r.avg_total_actions).toLocaleString()}
                    </span>
                    <span className="text-muted-foreground"> {r.department}</span>
                  </span>
                ))}
                {processingCapacity > 0 && (
                  <span className="text-xs">
                    <span className="font-medium text-foreground">~{processingCapacity.toLocaleString()}</span>
                    <span className="text-muted-foreground"> Processing</span>
                    <span className="text-muted-foreground/60"> est.</span>
                  </span>
                )}
                {returnsCapacity > 0 && (
                  <span className="text-xs">
                    <span className="font-medium text-foreground">~{returnsCapacity.toLocaleString()}</span>
                    <span className="text-muted-foreground"> Returns</span>
                    <span className="text-muted-foreground/60"> est.</span>
                  </span>
                )}
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
