'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { HelpButton, HelpModal } from '@/components/shared/HelpModal'
import type { HelpSection } from '@/components/shared/HelpModal'
import { SHIFT_QUARTERS, PRODUCTION_DEPARTMENTS, SHIFT_CONFIG } from '@/config/constants'
import { format, subDays } from 'date-fns'
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
  useUnpublishPlan,
  useUpdateDeptRoster,
} from '@/features/shift-plan/queries'
import { computeEffectiveHeadcount, computeRecommendedFlexes, computeVtoRecommendations } from '@/features/shift-plan/utils'
import { QuarterCard } from '@/features/shift-plan/components/QuarterCard'
import { QuarterDrawer } from '@/features/shift-plan/components/QuarterDrawer'
import { DeptSubmissionCard } from '@/features/shift-plan/components/DeptSubmissionCard'
import { HistoricalPlansModal } from '@/features/shift-plan/components/HistoricalPlansModal'
import { cn } from '@/lib/utils/cn'
import { History } from 'lucide-react'
import type { ShiftQuarter } from '@/config/constants'

const HELP_SECTIONS: HelpSection[] = [
  {
    title: 'What this page does',
    body: 'The Shift Plan gives you a real-time headcount picture broken into four quarters of the day. For each quarter you can see how many people are assigned per department, how many are predicted to be needed based on the last 6 weeks of same-weekday history, and where the gaps are.',
  },
  {
    title: 'The four quarters',
    body: [
      'Q1 · 5 AM — Hours 5, 6, 7 (inbound receiving window)',
      'Q2 · 8 AM — Hours 8, 9, 10 (peak processing)',
      'Q3 · 11 AM — Hours 11, 12, 1, 2 (mid-shift, typically highest volume)',
      'Q4 · 3 PM — Hours 3, 4, 5, 6 (wind-down, VTO eligible)',
    ],
  },
  {
    title: 'Reading the quarter cards',
    body: [
      'Green dot — all departments are adequately staffed for that quarter.',
      'Amber dot — at least one department is 1–2 people short.',
      'Red dot — at least one department is critically understaffed (3+ short).',
      '"Needed" numbers come from 6-week same-weekday historical averages. Fewer than 6 data points means the prediction is less reliable.',
      'Click any card to open the detailed drawer.',
    ],
  },
  {
    title: 'Labor flex moves',
    body: [
      'The system recommends flex moves based on your facility rules — Processing fills Picking, Returns → Material Handling → Picking fill Customer Service, and Picking surplus flows to Put Away.',
      'Recommendations appear in amber on the card and inside the drawer.',
      'All flex decisions are yours — confirm moves in the drawer to lock them in.',
    ],
  },
  {
    title: 'VTO recommendations',
    body: 'Q4 only — if departments show surplus headcount in the final quarter, the drawer flags them as VTO eligible. This means you have more people than predicted work requires. Offering VTO is always manager discretion.',
  },
  {
    title: 'Department submissions',
    body: [
      'Each department supervisor submits their morning numbers: callouts, OT associates, and exempt headcount.',
      'Submitted = locked in for that department. All departments submitted triggers the Publish button.',
      'Publishing freezes the plan and removes the submission cards.',
    ],
  },
  {
    title: 'How predicted headcount is calculated',
    body: 'The system pulls the last 6 Sundays (or same weekday) of hourly action data, computes the weighted UPH for each department based on the action mix, then divides total actions by (UPH × hours × 85% utilization factor) to get headcount needed. It rounds up — always.',
  },
]

// Build last 14 days as dropdown options (today first)
function buildDateOptions() {
  const today = new Date()
  return Array.from({ length: 14 }, (_, i) => {
    const d = subDays(today, i)
    const value = format(d, 'yyyy-MM-dd')
    const label = i === 0 ? `Today — ${format(d, 'EEE, MMM d')}`
      : i === 1 ? `Yesterday — ${format(d, 'EEE, MMM d')}`
      : format(d, 'EEE, MMM d')
    return { value, label }
  })
}

const DATE_OPTIONS = buildDateOptions()

export default function ShiftPlanPage() {
  const { selectedDate, setSelectedDate, selectedQuarter, setSelectedQuarter } = useShiftPlanStore()
  const [helpOpen, setHelpOpen]         = useState(false)
  const [historicalsOpen, setHistoricalsOpen] = useState(false)

  const { data: planData, isLoading: planLoading } = useShiftPlan(selectedDate)
  const { data: historical = [] } = useHistoricalDemand(selectedDate)
  const { data: historicalHourly = [] } = useHistoricalHourly(selectedDate)
  const planId = planData?.plan?.id
  const { data: flexEntries = [] } = useFlexEntries(planId)

  const submitDept    = useSubmitDept(selectedDate)
  const resetDept     = useResetSubmission(selectedDate)
  const updateRoster  = useUpdateDeptRoster(selectedDate)
  const addFlex       = useAddFlexEntry(planId)
  const deleteFlex    = useDeleteFlexEntry(planId)
  const publishPlan   = usePublishPlan(selectedDate)
  const unpublishPlan = useUnpublishPlan(selectedDate)

  const snapshots    = planData?.departments ?? []
  const isPublished  = !!planData?.plan?.publishedAt
  const submittedCount = snapshots.filter((s) => !!s.submission?.submittedAt).length

  // Build needed-by-dept map from historical for a given quarter.
  // Processing has no "needed" target — it's a flex source with no surplus/deficit concept.
  // Put Away and Material Handling are both derived from Processing effective headcount.
  function neededByDept(quarterNum: number): Record<string, number> {
    const map: Record<string, number> = {}
    for (const row of historical) {
      // Processing is intentionally excluded — no headcount target applies
      if (row.quarter === quarterNum && row.department !== 'Processing') {
        map[row.department] = Number(row.avg_headcount_needed)
      }
    }
    const processingSnap = snapshots.find((s) => s.department === 'Processing')
    if (processingSnap) {
      // Use flex-adjusted Processing effective — matches QuarterCard and QuarterDrawer logic
      const qFlexes    = flexEntries.filter((f) => f.quarter === quarterNum)
      const flexIn     = qFlexes.filter((f) => f.toDepartment   === 'Processing').reduce((s, f) => s + f.headcountMoved, 0)
      const flexOut    = qFlexes.filter((f) => f.fromDepartment === 'Processing').reduce((s, f) => s + f.headcountMoved, 0)
      const processingAdjEff = computeEffectiveHeadcount(processingSnap) + flexIn - flexOut
      map['Put Away'] = Math.ceil(
        (processingAdjEff * SHIFT_CONFIG.PROCESSING_DEFAULT_UPH) / SHIFT_CONFIG.PUTAWAY_DEFAULT_UPH
      )
      map['Material Handling'] = Math.ceil(processingAdjEff / SHIFT_CONFIG.MH_PROCESSORS_RATIO)
    }
    return map
  }

  // Drawer quarter data
  const drawerQuarter = selectedQuarter
    ? SHIFT_QUARTERS.find((q) => q.quarter === selectedQuarter) ?? null
    : null

  const drawerNeeded   = selectedQuarter ? neededByDept(selectedQuarter) : {}
  const drawerRecs     = selectedQuarter ? computeRecommendedFlexes(snapshots, drawerNeeded) : []
  const drawerVtoRecs  = selectedQuarter ? computeVtoRecommendations(snapshots, drawerNeeded, selectedQuarter) : []

  return (
    <div className="space-y-6">
      <HelpModal
        title="Shift Plan — Reference"
        subtitle="How to read and use this page"
        sections={HELP_SECTIONS}
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
      <HistoricalPlansModal
        isOpen={historicalsOpen}
        onClose={() => setHistoricalsOpen(false)}
      />
      <PageHeader
        title="Shift Plan"
        description="Daily headcount planning and labor flex decisions"
        actions={
          <div className="flex items-center gap-3">
            <HelpButton onClick={() => setHelpOpen(true)} />
            <button
              onClick={() => setHistoricalsOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <History className="h-4 w-4" />
              Historicals
            </button>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            >
              {DATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {!isPublished && planId && (
              <button
                onClick={() => publishPlan.mutate(planId)}
                disabled={publishPlan.isPending}
                className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {publishPlan.isPending ? 'Publishing…' : 'Publish Plan'}
              </button>
            )}
            {isPublished && planId && (
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-green-100 dark:bg-green-950/40 border border-green-200 dark:border-green-800 px-3 py-1.5 text-sm font-medium text-green-700 dark:text-green-400">
                  Plan Published
                </span>
                <button
                  onClick={() => unpublishPlan.mutate(planId)}
                  disabled={unpublishPlan.isPending}
                  className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  {unpublishPlan.isPending ? 'Unlocking…' : 'Edit Plan'}
                </button>
              </div>
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
              const qNeeded = neededByDept(q.quarter)
              const qRecs    = computeRecommendedFlexes(snapshots, qNeeded)
              const qVtoRecs = computeVtoRecommendations(snapshots, qNeeded, q.quarter)
              return (
                <QuarterCard
                  key={q.quarter}
                  quarter={q}
                  snapshots={snapshots}
                  historicalRows={historical}
                  confirmedFlexes={flexEntries}
                  recommendedFlexes={qRecs}
                  vtoRecommendations={qVtoRecs}
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
                      onUpdateRoster={(data) => updateRoster.mutate(data)}
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
          vtoRecommendations={drawerVtoRecs}
          isPublished={isPublished}
          onAddFlex={(entry) => addFlex.mutate(entry)}
          onDeleteFlex={(id) => deleteFlex.mutate(id)}
          onClose={() => setSelectedQuarter(null)}
        />
      )}
    </div>
  )
}
