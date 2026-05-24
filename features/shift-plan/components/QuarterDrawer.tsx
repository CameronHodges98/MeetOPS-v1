'use client'

import { X, Plus, Trash2, ArrowRight, Clock } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { SHIFT_QUARTERS, PRODUCTION_DEPARTMENTS, SHIFT_CONFIG, DEPT_DEFAULT_UPH } from '@/config/constants'
import type { FlexPlanEntry } from '@/lib/db/schema'
import type { DeptSnapshot, RecommendedFlex, VtoRecommendation } from '../utils'
import type { HistoricalRow, HistoricalHourRow } from '../queries'
import { computeEffectiveHeadcount, computeGap, gapStatus, gapLabel } from '../utils'

const HOUR_LABELS: Record<number, string> = {
  5: '5 AM', 6: '6 AM', 7: '7 AM', 8: '8 AM', 9: '9 AM', 10: '10 AM',
  11: '11 AM', 12: '12 PM', 13: '1 PM', 14: '2 PM', 15: '3 PM',
  16: '4 PM', 17: '5 PM', 18: '6 PM',
}

const GAP_COLORS = {
  green: 'text-green-600 dark:text-green-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red:   'text-red-600 dark:text-red-400',
}

interface QuarterDrawerProps {
  quarterNum: number
  snapshots: DeptSnapshot[]
  historicalRows: HistoricalRow[]
  historicalHourlyRows: HistoricalHourRow[]
  confirmedFlexes: FlexPlanEntry[]
  recommendedFlexes: RecommendedFlex[]
  vtoRecommendations: VtoRecommendation[]
  isPublished: boolean
  onAddFlex: (entry: { quarter: number; fromDepartment: string; toDepartment: string; headcountMoved: number }) => void
  onDeleteFlex: (id: number) => void
  onClose: () => void
}

export function QuarterDrawer({
  quarterNum,
  snapshots,
  historicalRows,
  historicalHourlyRows,
  confirmedFlexes,
  recommendedFlexes,
  vtoRecommendations,
  isPublished,
  onAddFlex,
  onDeleteFlex,
  onClose,
}: QuarterDrawerProps) {
  const quarter = SHIFT_QUARTERS.find((q) => q.quarter === quarterNum)!
  // Historical rows still used for headcount-needed per dept (gap analysis)
  const CAPACITY_EST_DEPTS = new Set(['Processing', 'Returns'])
  const qHistorical = historicalRows.filter((r) => r.quarter === quarterNum && !CAPACITY_EST_DEPTS.has(r.department))
  const qFlexes = confirmedFlexes.filter((f) => f.quarter === quarterNum)

  const [addingFlex, setAddingFlex] = useState(false)
  const [newFrom, setNewFrom] = useState('')
  const [newTo, setNewTo] = useState('')
  const [newCount, setNewCount] = useState('')

  function submitFlex() {
    const count = parseInt(newCount)
    if (!newFrom || !newTo || !count || newFrom === newTo) return
    onAddFlex({ quarter: quarterNum, fromDepartment: newFrom, toDepartment: newTo, headcountMoved: count })
    setNewFrom(''); setNewTo(''); setNewCount(''); setAddingFlex(false)
  }

  // Flex-adjusted effective headcount helpers
  const flexInFor  = (dept: string) => qFlexes.filter((f) => f.toDepartment   === dept).reduce((s, f) => s + f.headcountMoved, 0)
  const flexOutFor = (dept: string) => qFlexes.filter((f) => f.fromDepartment === dept).reduce((s, f) => s + f.headcountMoved, 0)

  // Processing effective after flex moves out — drives Put Away and MH needed
  const processingSnap    = snapshots.find((s) => s.department === 'Processing')
  const processingBaseEff = processingSnap ? computeEffectiveHeadcount(processingSnap) : 0
  const processingAdjEff  = processingBaseEff + flexInFor('Processing') - flexOutFor('Processing')

  // Per-dept rows for the summary table
  const deptRows = snapshots.map((snap) => {
    const hist         = qHistorical.find((r) => r.department === snap.department)
    const baseEff      = computeEffectiveHeadcount(snap)
    const effective    = baseEff + flexInFor(snap.department) - flexOutFor(snap.department)
    const isProcessing = snap.department === 'Processing'
    const isReturns    = snap.department === 'Returns'
    const isCapacityEst = isProcessing || isReturns

    // Needed is derived for Processing-linked depts; raw historical for everything else
    let needed = 0
    if (snap.department === 'Put Away') {
      needed = Math.ceil((processingAdjEff * SHIFT_CONFIG.PROCESSING_DEFAULT_UPH) / SHIFT_CONFIG.PUTAWAY_DEFAULT_UPH)
    } else if (snap.department === 'Material Handling') {
      needed = Math.ceil(processingAdjEff / SHIFT_CONFIG.MH_PROCESSORS_RATIO)
    } else if (!isCapacityEst) {
      needed = hist ? Number(hist.avg_headcount_needed) : 0
    }

    const gap = computeGap(effective, needed)

    // Capacity estimate: what current headcount × UPH should produce this quarter
    const uph = DEPT_DEFAULT_UPH[snap.department]
    const actions = uph
      ? Math.round(effective * uph * quarter.hours.length * SHIFT_CONFIG.UTILIZATION_FACTOR)
      : 0
    // Historical average for comparison (excluded for Processing/Returns — capacity est only)
    const histActions = hist ? Number(hist.avg_total_actions) : 0

    return { dept: snap.department, effective, needed, gap, actions, histActions, isCapacityEst: !!uph, status: gapStatus(gap) }
  })

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-background border-l border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-bold">{quarter.label} — Detail</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hours: {quarter.hours.map((h) => HOUR_LABELS[h]).join(', ')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* ── Dept summary table ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Department Breakdown
            </h3>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Department</th>
                    <th className="px-3 py-2 text-right font-medium">Assigned</th>
                    <th className="px-3 py-2 text-right font-medium">Needed</th>
                    <th className="px-3 py-2 text-right font-medium">Gap</th>
                    <th className="px-3 py-2 text-right font-medium">Est. / Hist.</th>
                  </tr>
                </thead>
                <tbody>
                  {deptRows.map((r, i) => (
                    <tr key={r.dept} className={cn('border-b last:border-0 border-border', i % 2 === 0 ? '' : 'bg-muted/20')}>
                      <td className="px-3 py-2 font-medium">{r.dept}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.effective}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {r.needed > 0 ? r.needed : '—'}
                      </td>
                      <td className={cn('px-3 py-2 text-right tabular-nums font-semibold', GAP_COLORS[r.status])}>
                        {r.needed > 0 ? gapLabel(r.gap) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <div className="flex flex-col items-end gap-0.5">
                          {r.actions > 0
                            ? <span className="text-foreground font-medium" title="Estimated capacity: headcount × UPH × hours × 85%">
                                ~{r.actions.toLocaleString()}
                              </span>
                            : <span className="text-muted-foreground">—</span>
                          }
                          {r.histActions > 0
                            ? <span className="text-xs text-muted-foreground/70">{r.histActions.toLocaleString()} hist.</span>
                            : null
                          }
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Hour-by-hour breakdown ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Hour-by-Hour (Predicted)
            </h3>
            <div className="space-y-1.5">
              {quarter.hours.map((h) => {
                const label = HOUR_LABELS[h]
                // Per-hour capacity + historical average per dept
                const hourRows = snapshots
                  .filter((s) => DEPT_DEFAULT_UPH[s.department] != null)
                  .map((s) => {
                    const uph = DEPT_DEFAULT_UPH[s.department]
                    const eff = computeEffectiveHeadcount(s)
                    const cap = Math.round(eff * uph * SHIFT_CONFIG.UTILIZATION_FACTOR)
                    const histRow = historicalHourlyRows.find(
                      (r) => r.hour === h && r.department === s.department
                    )
                    const hist = histRow ? Number(histRow.avg_total_actions) : 0
                    return { dept: s.department, cap, hist }
                  })
                  .filter((r) => r.cap > 0 || r.hist > 0)

                const totalCap  = hourRows.reduce((s, r) => s + r.cap, 0)
                const totalHist = hourRows.reduce((s, r) => s + r.hist, 0)

                return (
                  <div key={h} className="rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold">{label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {totalCap > 0
                          ? <>~{totalCap.toLocaleString()} est.{totalHist > 0 && <span className="opacity-60"> · {totalHist.toLocaleString()} hist.</span>}</>
                          : 'No headcount'}
                      </span>
                    </div>
                    {hourRows.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {hourRows.map((r) => (
                          <span key={r.dept} className="text-xs text-muted-foreground">
                            {r.dept}:{' '}
                            <span className="text-foreground font-medium">~{r.cap.toLocaleString()}</span>
                            {r.hist > 0 && <span className="opacity-60">/{r.hist.toLocaleString()}</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── VTO recommendations (Q4 only) ── */}
          {vtoRecommendations.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                VTO Eligible
              </h3>
              <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3 space-y-1.5">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                    Surplus headcount — consider offering VTO
                  </p>
                </div>
                {vtoRecommendations.map((r) => (
                  <div key={r.department} className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-400">
                    <span>{r.department}</span>
                    <span className="font-semibold tabular-nums">
                      {r.headcountEligible} eligible
                    </span>
                  </div>
                ))}
                <p className="text-xs text-blue-600/70 dark:text-blue-500 pt-1">
                  Manager discretion — offer VTO to willing associates.
                </p>
              </div>
            </section>
          )}

          {/* ── Flex plan ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Labor Flex
              </h3>
              {!isPublished && (
                <button
                  onClick={() => setAddingFlex(true)}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add flex move
                </button>
              )}
            </div>

            {/* Recommendations */}
            {recommendedFlexes.length > 0 && qFlexes.length === 0 && (
              <div className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5">
                  Recommended moves
                </p>
                {recommendedFlexes.map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    +{r.headcountMoved} {r.fromDepartment} → {r.toDepartment}
                  </div>
                ))}
              </div>
            )}

            {/* Confirmed flexes */}
            <div className="space-y-2">
              {qFlexes.length === 0 && !addingFlex && (
                <p className="text-xs text-muted-foreground italic">No flex moves confirmed for this quarter.</p>
              )}
              {qFlexes.map((f) => (
                <div key={f.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="flex-1 text-sm font-medium">
                    +{f.headcountMoved} {f.fromDepartment} → {f.toDepartment}
                  </span>
                  {!isPublished && (
                    <button
                      onClick={() => onDeleteFlex(f.id)}
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {/* Add flex form */}
              {addingFlex && (
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground">New flex move</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">From</label>
                      <select
                        value={newFrom}
                        onChange={(e) => setNewFrom(e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                      >
                        <option value="">Select dept</option>
                        {PRODUCTION_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">To</label>
                      <select
                        value={newTo}
                        onChange={(e) => setNewTo(e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                      >
                        <option value="">Select dept</option>
                        {PRODUCTION_DEPARTMENTS.filter((d) => d !== newFrom).map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Headcount to move</label>
                    <input
                      type="number"
                      min={1}
                      value={newCount}
                      onChange={(e) => setNewCount(e.target.value)}
                      placeholder="e.g. 3"
                      className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={submitFlex}
                      disabled={!newFrom || !newTo || !newCount}
                      className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => { setAddingFlex(false); setNewFrom(''); setNewTo(''); setNewCount('') }}
                      className="flex-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
