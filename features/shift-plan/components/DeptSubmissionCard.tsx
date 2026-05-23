'use client'

import { useState } from 'react'
import { Plus, Trash2, CheckCircle2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { DeptSnapshot } from '../utils'
import type { ExemptEntry } from '@/app/api/shift-plan/submissions/route'
import { computeEffectiveHeadcount, getExemptTotal } from '../utils'

interface DeptSubmissionCardProps {
  snap: DeptSnapshot
  planId: number
  isPublished: boolean
  onSubmit: (data: {
    planId: number
    department: string
    calloutCount: number
    otCount: number
    exemptEntries: ExemptEntry[]
  }) => void
}

export function DeptSubmissionCard({ snap, planId, isPublished, onSubmit }: DeptSubmissionCardProps) {
  const sub = snap.submission
  const [callouts, setCallouts] = useState(sub?.calloutCount ?? 0)
  const [ot, setOt] = useState(sub?.otCount ?? 0)
  const [exempts, setExempts] = useState<ExemptEntry[]>(
    (sub?.exemptEntries as ExemptEntry[]) ?? []
  )
  const [dirty, setDirty] = useState(false)

  const isSubmitted = !!sub?.submittedAt && !dirty

  function addExempt() {
    setExempts((prev) => [...prev, { count: 1, reason: '' }])
    setDirty(true)
  }

  function updateExempt(i: number, patch: Partial<ExemptEntry>) {
    setExempts((prev) => prev.map((e, idx) => idx === i ? { ...e, ...patch } : e))
    setDirty(true)
  }

  function removeExempt(i: number) {
    setExempts((prev) => prev.filter((_, idx) => idx !== i))
    setDirty(true)
  }

  function handleSubmit() {
    onSubmit({ planId, department: snap.department, calloutCount: callouts, otCount: ot, exemptEntries: exempts })
    setDirty(false)
  }

  const effective = computeEffectiveHeadcount({
    ...snap,
    submission: sub ? { ...sub, calloutCount: callouts, otCount: ot, exemptEntries: exempts } : null,
  })
  const exemptTotal = getExemptTotal(exempts)

  return (
    <div className={cn(
      'rounded-xl border-2 p-4 transition-all',
      isSubmitted ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20' : 'border-border bg-card'
    )}>
      {/* Dept header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold">{snap.department}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Roster: <span className="font-semibold text-foreground">{snap.scheduledCount}</span>
          </span>
          {isSubmitted
            ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            : <Clock className="h-4 w-4 text-muted-foreground" />
          }
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-muted-foreground">Callouts</label>
          <input
            type="number"
            min={0}
            max={snap.scheduledCount}
            value={callouts}
            disabled={isPublished}
            onChange={(e) => { setCallouts(Number(e.target.value)); setDirty(true) }}
            className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">OT Available</label>
          <input
            type="number"
            min={0}
            value={ot}
            disabled={isPublished}
            onChange={(e) => { setOt(Number(e.target.value)); setDirty(true) }}
            className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
          />
        </div>
      </div>

      {/* Exempt entries */}
      <div className="mb-3 space-y-1.5">
        {exempts.map((e, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              type="number"
              min={1}
              value={e.count}
              disabled={isPublished}
              onChange={(ev) => updateExempt(i, { count: Number(ev.target.value) })}
              className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
            />
            <input
              type="text"
              placeholder="Reason (e.g. Training)"
              value={e.reason}
              disabled={isPublished}
              onChange={(ev) => updateExempt(i, { reason: ev.target.value })}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
            />
            {!isPublished && (
              <button onClick={() => removeExempt(i)} className="text-muted-foreground hover:text-red-500 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {!isPublished && (
          <button
            onClick={addExempt}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" /> Add exempt
          </button>
        )}
      </div>

      {/* Effective headcount summary */}
      <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs mb-3">
        <span className="text-muted-foreground">
          {snap.scheduledCount} − {callouts} callouts − {exemptTotal} exempt + {ot} OT
        </span>
        <span className="font-bold text-foreground text-sm">{effective} effective</span>
      </div>

      {/* Submit button */}
      {!isPublished && (
        <button
          onClick={handleSubmit}
          disabled={!dirty && isSubmitted}
          className={cn(
            'w-full rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
            dirty || !isSubmitted
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          {isSubmitted && !dirty ? 'Submitted' : 'Submit'}
        </button>
      )}
    </div>
  )
}
