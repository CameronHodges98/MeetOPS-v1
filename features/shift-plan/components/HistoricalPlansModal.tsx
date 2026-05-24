'use client'

import { useState } from 'react'
import { X, ChevronDown, ChevronRight, ArrowRight, CheckCircle2, Clock } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils/cn'
import { SHIFT_QUARTERS, SHIFT_CONFIG } from '@/config/constants'
import { useWarehouseStore } from '@/lib/stores/warehouse'
import type { FlexPlanEntry, ShiftPlan, ShiftPlanSubmission } from '@/lib/db/schema'
import type { ExemptEntry } from '@/app/api/shift-plan/submissions/route'
import { computeEffectiveHeadcount, computeOnSiteHeadcount } from '../utils'
import type { DeptSnapshot } from '../utils'

interface HistoricalEntry {
  plan: ShiftPlan
  departments: DeptSnapshot[]
  flexEntries: FlexPlanEntry[]
}

function useHistoricalPlans(enabled: boolean) {
  const location = useWarehouseStore((s) => s.activeWarehouse?.name ?? 'Mesa')
  return useQuery<HistoricalEntry[]>({
    queryKey: ['shift-plan-history', location],
    queryFn: async () => {
      const res = await fetch(`/api/shift-plan/history?location=${encodeURIComponent(location)}&limit=30`)
      if (!res.ok) throw new Error('Failed to load historical plans')
      return res.json()
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  })
}

interface HistoricalPlansModalProps {
  isOpen: boolean
  onClose: () => void
}

export function HistoricalPlansModal({ isOpen, onClose }: HistoricalPlansModalProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const { data: entries = [], isLoading } = useHistoricalPlans(isOpen)

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-background border border-border rounded-2xl shadow-2xl flex flex-col"
          style={{ minWidth: '50vw', maxWidth: '75vw', maxHeight: '75vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div>
              <h2 className="text-base font-bold">Historical Shift Plans</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Past 30 days — click a plan to expand</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
            {isLoading && (
              <p className="text-sm text-muted-foreground text-center py-8">Loading plans…</p>
            )}
            {!isLoading && entries.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No historical plans found.</p>
            )}
            {entries.map((entry) => (
              <PlanRow
                key={entry.plan.id}
                entry={entry}
                isExpanded={expandedId === entry.plan.id}
                onToggle={() => setExpandedId(expandedId === entry.plan.id ? null : entry.plan.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function PlanRow({ entry, isExpanded, onToggle }: {
  entry: HistoricalEntry
  isExpanded: boolean
  onToggle: () => void
}) {
  const { plan, departments, flexEntries } = entry
  const submittedCount = departments.filter((d) => !!d.submission?.submittedAt).length
  const totalDepts     = departments.length
  const allSubmitted   = submittedCount === totalDepts
  const dateLabel      = format(parseISO(plan.date), 'EEE, MMM d, yyyy')

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Row header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {isExpanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          }
          <span className="text-sm font-semibold">{dateLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{submittedCount}/{totalDepts} submitted</span>
          {plan.publishedAt ? (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 font-medium">
              <CheckCircle2 className="h-3 w-3" />
              Published
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground font-medium">
              <Clock className="h-3 w-3" />
              Draft
            </span>
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4 bg-muted/10">
          {/* Dept table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Department</th>
                  <th className="px-3 py-2 text-right font-medium">Scheduled</th>
                  <th className="px-3 py-2 text-right font-medium">Callouts</th>
                  <th className="px-3 py-2 text-right font-medium">OT</th>
                  <th className="px-3 py-2 text-right font-medium">On-site</th>
                  <th className="px-3 py-2 text-right font-medium">Effective</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((snap, i) => {
                  const sub      = snap.submission
                  const onSite   = computeOnSiteHeadcount(snap)
                  const effective = computeEffectiveHeadcount(snap)
                  const exemptEntries = (sub?.exemptEntries ?? []) as ExemptEntry[]
                  const indirectCount = exemptEntries.filter((e) => e.exempt).reduce((s, e) => s + (e.count ?? 0), 0)
                  return (
                    <tr key={snap.department} className={cn('border-b last:border-0 border-border', i % 2 !== 0 && 'bg-muted/20')}>
                      <td className="px-3 py-2 font-medium">{snap.department}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{snap.scheduledCount}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {sub ? (
                          <span className={cn(sub.calloutCount > 0 && 'text-red-500 dark:text-red-400 font-medium')}>
                            {sub.calloutCount}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {sub ? (
                          <span className={cn(sub.otCount > 0 && 'text-green-600 dark:text-green-400 font-medium')}>
                            +{sub.otCount}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{sub ? onSite : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {sub ? (
                          <span>
                            {effective}
                            {indirectCount > 0 && (
                              <span className="text-xs font-normal text-muted-foreground ml-1">({indirectCount} indirect)</span>
                            )}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Flex moves grouped by quarter */}
          {flexEntries.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Labor Flex Moves</p>
              <div className="space-y-2">
                {SHIFT_QUARTERS.map((q) => {
                  const qFlexes = flexEntries.filter((f) => f.quarter === q.quarter)
                  if (qFlexes.length === 0) return null
                  return (
                    <div key={q.quarter} className="rounded-lg border border-border px-3 py-2">
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">{q.label}</p>
                      <div className="space-y-1">
                        {qFlexes.map((f) => (
                          <div key={f.id} className="flex items-center gap-1.5 text-xs text-foreground">
                            <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                            <span>+{f.headcountMoved} {f.fromDepartment} → {f.toDepartment}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {flexEntries.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No flex moves on this plan.</p>
          )}
        </div>
      )}
    </div>
  )
}
