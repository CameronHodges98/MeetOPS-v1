'use client'

import { X, Plus, Trash2, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { SHIFT_QUARTERS, PRODUCTION_DEPARTMENTS } from '@/config/constants'
import type { FlexPlanEntry } from '@/lib/db/schema'
import type { DeptSnapshot, RecommendedFlex } from '../utils'
import type { HistoricalRow } from '../queries'
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
  confirmedFlexes: FlexPlanEntry[]
  recommendedFlexes: RecommendedFlex[]
  isPublished: boolean
  onAddFlex: (entry: { quarter: number; fromDepartment: string; toDepartment: string; headcountMoved: number }) => void
  onDeleteFlex: (id: number) => void
  onClose: () => void
}

export function QuarterDrawer({
  quarterNum,
  snapshots,
  historicalRows,
  confirmedFlexes,
  recommendedFlexes,
  isPublished,
  onAddFlex,
  onDeleteFlex,
  onClose,
}: QuarterDrawerProps) {
  const quarter = SHIFT_QUARTERS.find((q) => q.quarter === quarterNum)!
  const qHistorical = historicalRows.filter((r) => r.quarter === quarterNum)
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

  // Per-dept rows for the summary table
  const deptRows = snapshots.map((snap) => {
    const hist = qHistorical.find((r) => r.department === snap.department)
    const effective = computeEffectiveHeadcount(snap)
    const needed = hist ? Number(hist.avg_headcount_needed) : 0
    const gap = computeGap(effective, needed)
    const actions = hist ? Number(hist.avg_total_actions) : 0
    return { dept: snap.department, effective, needed, gap, actions, status: gapStatus(gap) }
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
                    <th className="px-3 py-2 text-right font-medium">Pred. Actions</th>
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
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {r.actions > 0 ? r.actions.toLocaleString() : '—'}
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
              Hour-by-Hour (Predicted Actions)
            </h3>
            <div className="space-y-1.5">
              {quarter.hours.map((h) => {
                const label = HOUR_LABELS[h]
                const hourRows = qHistorical.map((r) => ({
                  dept: r.department,
                  // Distribute quarterly avg evenly across hours for approximation
                  actions: Math.round(Number(r.avg_total_actions) / quarter.hours.length),
                })).filter((r) => r.actions > 0)

                const totalHourActions = hourRows.reduce((s, r) => s + r.actions, 0)

                return (
                  <div key={h} className="rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold">{label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {totalHourActions > 0 ? `~${totalHourActions.toLocaleString()} actions` : 'No data'}
                      </span>
                    </div>
                    {hourRows.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {hourRows.map((r) => (
                          <span key={r.dept} className="text-xs text-muted-foreground">
                            {r.dept}: <span className="text-foreground font-medium">{r.actions.toLocaleString()}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

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
