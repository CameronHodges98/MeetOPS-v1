'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, CheckCircle2, Clock, RotateCcw, Pencil, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { DeptSnapshot } from '../utils'
import type { ExemptEntry } from '@/app/api/shift-plan/submissions/route'
import { computeEffectiveHeadcount, computeOnSiteHeadcount, getExemptTotal, getExemptOnlyTotal } from '../utils'

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
  onReset: (data: { planId: number; department: string }) => void
  onUpdateRoster: (data: { department: string; count: number }) => void
}

export function DeptSubmissionCard({ snap, planId, isPublished, onSubmit, onReset, onUpdateRoster }: DeptSubmissionCardProps) {
  const sub = snap.submission
  const [callouts, setCallouts] = useState(sub?.calloutCount ?? 0)
  const [ot, setOt] = useState(sub?.otCount ?? 0)
  const [exempts, setExempts] = useState<ExemptEntry[]>(
    (sub?.exemptEntries as ExemptEntry[]) ?? []
  )
  const [dirty, setDirty] = useState(false)

  // Roster inline edit state
  const [editingRoster, setEditingRoster] = useState(false)
  const [rosterInput, setRosterInput] = useState(snap.scheduledCount)
  const rosterInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingRoster) rosterInputRef.current?.focus()
  }, [editingRoster])

  function saveRoster() {
    onUpdateRoster({ department: snap.department, count: rosterInput })
    setEditingRoster(false)
  }

  function cancelRoster() {
    setRosterInput(snap.scheduledCount)
    setEditingRoster(false)
  }

  const isSubmitted = !!sub?.submittedAt && !dirty

  function addExempt() {
    setExempts((prev) => [...prev, { count: 1, reason: '', exempt: false }])
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

  function handleReset() {
    setCallouts(0)
    setOt(0)
    setExempts([])
    setDirty(false)
    onReset({ planId, department: snap.department })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const previewSnap: DeptSnapshot = {
    ...snap,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submission: { ...(sub ?? {} as any), calloutCount: callouts, otCount: ot, exemptEntries: exempts },
  }
  const onSite = computeOnSiteHeadcount(previewSnap)
  const designatedTotal = getExemptTotal(exempts)
  const indirectTotal = getExemptOnlyTotal(exempts)
  const effective = computeEffectiveHeadcount(previewSnap)

  return (
    <div className={cn(
      'rounded-xl border-2 p-4 transition-all',
      isSubmitted ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20' : 'border-border bg-card'
    )}>
      {/* Dept header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold">{snap.department}</h3>
        <div className="flex items-center gap-2">
          {/* Roster inline editor */}
          {editingRoster ? (
            <div className="flex items-center gap-1">
              <input
                ref={rosterInputRef}
                type="number"
                min={0}
                value={rosterInput}
                onChange={(e) => setRosterInput(Number(e.target.value))}
                onKeyDown={(e) => { if (e.key === 'Enter') saveRoster(); if (e.key === 'Escape') cancelRoster() }}
                className="w-14 rounded-md border border-primary bg-background px-2 py-0.5 text-sm font-semibold text-center"
              />
              <button onClick={saveRoster} className="text-green-600 hover:text-green-500 transition-colors" title="Save">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={cancelRoster} className="text-muted-foreground hover:text-foreground transition-colors" title="Cancel">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">
                Roster: <span className="font-semibold text-foreground">{snap.scheduledCount}</span>
              </span>
              {!isPublished && (
                <button
                  onClick={() => { setRosterInput(snap.scheduledCount); setEditingRoster(true) }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Update roster"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
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

      {/* Designated (non-production) roles */}
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
              placeholder="Role (e.g. Auditor, Trainer)"
              value={e.reason}
              disabled={isPublished}
              onChange={(ev) => updateExempt(i, { reason: ev.target.value })}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
            />
            <label className={cn('flex items-center gap-1 text-xs whitespace-nowrap', isPublished ? 'opacity-50' : 'cursor-pointer')}>
              <input
                type="checkbox"
                checked={!!e.exempt}
                disabled={isPublished}
                onChange={(ev) => updateExempt(i, { exempt: ev.target.checked })}
                className="rounded"
              />
              <span className="text-muted-foreground">Exempt</span>
            </label>
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
            <Plus className="h-3 w-3" /> Add designated role
          </button>
        )}
      </div>

      {/* Headcount summary */}
      <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs mb-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            {snap.scheduledCount} scheduled − {callouts} callouts + {ot} OT
            {designatedTotal > 0 && (
              <span className="ml-1 text-muted-foreground/70">
                ({designatedTotal} designated{indirectTotal > 0 ? `, ${indirectTotal} indirect` : ''})
              </span>
            )}
          </span>
          <span className="font-medium text-foreground">{onSite} on-site</span>
        </div>
        {indirectTotal > 0 && (
          <div className="flex items-center justify-between border-t border-border/50 pt-1">
            <span className="text-muted-foreground">− {indirectTotal} indirect (exempt)</span>
            <span className="font-bold text-foreground text-sm">{effective} production</span>
          </div>
        )}
        {indirectTotal === 0 && (
          <div className="flex items-center justify-end">
            <span className="font-bold text-foreground text-sm">{effective} production effective</span>
          </div>
        )}
      </div>

      {/* Submit / Reset buttons */}
      {!isPublished && (
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={!dirty && isSubmitted}
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
              dirty || !isSubmitted
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {isSubmitted && !dirty ? 'Submitted' : 'Submit'}
          </button>
          {(isSubmitted || callouts > 0 || ot > 0 || exempts.length > 0) && (
            <button
              onClick={handleReset}
              title="Reset to incomplete"
              className="rounded-lg border border-border px-2.5 py-2 text-muted-foreground hover:text-red-500 hover:border-red-300 dark:hover:border-red-800 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
