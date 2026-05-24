'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SHIFT_QUARTERS, PRODUCTION_DEPARTMENTS } from '@/config/constants'
import { useShiftPlanStore } from '@/features/shift-plan/store'
import {
  useShiftPlan,
  useHistoricalDemand,
  useHistoricalHourly,
  useFlexEntries,
  useAddFlexEntry,
  useDeleteFlexEntry,
  useSubmitDept,
  useResetSubmission,
  usePublishPlan,
} from '@/features/shift-plan/queries'
import { computeEffectiveHeadcount, computeRecommendedFlexes } from '@/features/shift-plan/utils'
import { QuarterCard } from '@/features/shift-plan/components/QuarterCard'
import { QuarterDrawer } from '@/features/shift-plan/components/QuarterDrawer'
import { DeptSubmissionCard } from '@/features/shift-plan/components/DeptSubmissionCard'
import { cn } from '@/lib/utils/cn'
import type { ShiftQuarter } from '@/config/constants'

export default function ShiftPlanPage() {
  const { selectedDate, setSelectedDate, selectedQuarter, setSelectedQuarter } = useShiftPlanStore()

  const { data: planData, isLoading: planLoading } = useShiftPlan(selectedDate)
  const { data: historical = [] } = useHistoricalDemand(selectedDate)
  const { data: historicalHourly = [] } = useHistoricalHourly(selectedDate)
  const planId = planData?.plan?.id
  const { data: flexEntries = [] } = useFlexEntries(planId)

  const submitDept   = useSubmitDept(selectedDate)
  const resetDept    = useResetSubmission(selectedDate)
  const addFlex      = useAddFlexEntry(planId)
  const deleteFlex   = useDeleteFlexEntry(planId)
  const publishPlan  = usePublishPlan(selectedDate)

  const snapshots    = planData?.departments ?? []
  const isPublished  = !!planData?.plan?.publishedAt
  const submittedCount = snapshots.filter((s) => !!s.submission?.submittedAt).length

  // Build needed-by-dept map from historical for a given quarter
  function neededByDept(quarterNum: number): Record<string, number> {
    const map: Record<string, number> = {}
    for (const row of historical) {
      if (row.quarter === quarterNum) map[row.department] = Number(row.avg_headcount_needed)
    }
    return map
  }

  // Drawer quarter data
  const drawerQuarter = selectedQuarter
    ? SHIFT_QUARTERS.find((q) => q.quarter === selectedQuarter) ?? null
    : null

  const drawerNeeded = selectedQuarter ? neededByDept(selectedQuarter) : {}
  const drawerRecs   = selectedQuarter
    ? computeRecommendedFlexes(snapshots, drawerNeeded)
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shift Plan"
        description="Daily headcount planning and labor flex decisions"
        actions={
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            />
            {!isPublished && planId && (
              <button
                onClick={() => publishPlan.mutate(planId)}
                disabled={publishPlan.isPending}
                className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {publishPlan.isPending ? 'Publishing…' : 'Publish Plan'}
              </button>
            )}
            {isPublished && (
              <span className="rounded-md bg-green-100 dark:bg-green-950/40 border border-green-200 dark:border-green-800 px-3 py-1.5 text-sm font-medium text-green-700 dark:text-green-400">
                Plan Published
              </span>
            )}
          </div>
        }
      />

      {planLoading ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground text-sm">
          Loading shift plan…
        </div>
      ) : (
        <>
          {/* ── Quarter overview cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {SHIFT_QUARTERS.map((q) => {
              const qRecs = computeRecommendedFlexes(snapshots, neededByDept(q.quarter))
              return (
                <QuarterCard
                  key={q.quarter}
                  quarter={q}
                  snapshots={snapshots}
                  historicalRows={historical}
                  confirmedFlexes={flexEntries}
                  recommendedFlexes={qRecs}
                  submittedCount={submittedCount}
                  totalDepts={PRODUCTION_DEPARTMENTS.length}
                  isPublished={isPublished}
                  onClick={() => setSelectedQuarter(q.quarter as ShiftQuarter)}
                />
              )
            })}
          </div>

          {/* ── AM submission cards ── */}
          {!isPublished && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Department Submissions</h2>
                <span className="text-xs text-muted-foreground">
                  {submittedCount} of {PRODUCTION_DEPARTMENTS.length} submitted
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {snapshots
                  .filter((s) => PRODUCTION_DEPARTMENTS.includes(s.department as typeof PRODUCTION_DEPARTMENTS[number]))
                  .map((snap) => (
                    <DeptSubmissionCard
                      key={snap.department}
                      snap={snap}
                      planId={planId!}
                      isPublished={isPublished}
                      onSubmit={(data) => submitDept.mutate(data)}
                      onReset={(data) => resetDept.mutate(data)}
                    />
                  ))}
              </div>
            </section>
          )}

          {/* Published read-only summary */}
          {isPublished && (
            <section className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 p-5">
              <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-3">
                Plan published — all departments finalized
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                {snapshots.map((snap) => {
                  const effective = computeEffectiveHeadcount(snap)
                  return (
                    <div key={snap.department} className="rounded-lg border border-green-200 dark:border-green-800 bg-background px-3 py-2 text-center">
                      <p className="text-lg font-bold tabular-nums">{effective}</p>
                      <p className="text-xs text-muted-foreground">{snap.department}</p>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── Quarter detail drawer ── */}
      {drawerQuarter && planId && (
        <QuarterDrawer
          quarterNum={drawerQuarter.quarter}
          snapshots={snapshots}
          historicalRows={historical}
          historicalHourlyRows={historicalHourly}
          confirmedFlexes={flexEntries}
          recommendedFlexes={drawerRecs}
          isPublished={isPublished}
          onAddFlex={(entry) => addFlex.mutate(entry)}
          onDeleteFlex={(id) => deleteFlex.mutate(id)}
          onClose={() => setSelectedQuarter(null)}
        />
      )}
    </div>
  )
}
