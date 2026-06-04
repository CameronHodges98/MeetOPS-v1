'use client'

import { useState } from 'react'
import { Plus, Trash2, CheckCircle2, Clock, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { DeptSnapshot, ShiftEntry } from '../utils'
import type { ExemptEntry } from '@/app/api/shift-plan/submissions/route'
import { computeEffectiveHeadcount, computeOnSiteHeadcount, getExemptTotal, getExemptOnlyTotal } from '../utils'

interface DeptSubmissionCardProps {
  snap: DeptSnapshot
  planId: number
  date: string  // "yyyy-MM-dd"
  isPublished: boolean
  onSubmit: (data: {
    planId: number
    department: string
    calloutCount: number
    otCount: number
    exemptEntries: ExemptEntry[]
  }) => void
  onReset: (data: { planId: number; department: string }) => void
  onUpdateRoster: (data: { department: string; count: number; dayType: 'weekday' | 'weekend'; shiftSchedule?: ShiftEntry[] | null }) => void
}

// Fri (5), Sat (6), Sun (0) are weekend; Mon–Thu (1–4) are weekday
function isWeekendDate(dateStr: string): boolean {
  const day = new Date(dateStr + 'T12:00:00').getDay()
  return day === 0 || day === 5 || day === 6
}

function defaultShifts(): ShiftEntry[] {
  return [
    { startTime: '05:00', endTime: '14:00', count: 1 },
    { startTime: '06:00', endTime: '15:00', count: 1 },
  ]
}

export function DeptSubmissionCard({ snap, planId, date, isPublished, onSubmit, onReset, onUpdateRoster }: DeptSubmissionCardProps) {
  const sub = snap.submission
  const [callouts, setCallouts] = useState(sub?.calloutCount ?? 0)
  const [ot, setOt] = useState(sub?.otCount ?? 0)
  const [exempts, setExempts] = useState<ExemptEntry[]>(
    (sub?.exemptEntries as ExemptEntry[]) ?? []
  )
  const [dirty, setDirty] = useState(false)

  const weekend = isWeekendDate(date)

  // Shift schedule state — seed with 2 default slots when no shifts are saved yet
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleEdits, setScheduleEdits] = useState<ShiftEntry[]>(
    snap.shiftSchedule && snap.shiftSchedule.length > 0 ? snap.shiftSchedule : defaultShifts()
  )
  const [scheduleDirty, setScheduleDirty] = useState(
    !(snap.shiftSchedule && snap.shiftSchedule.length > 0)
  )

  // Roster is derived from the sum of all shift counts
  const rosterCount = scheduleEdits.reduce((s, e) => s + (e.count ?? 0), 0)

  function addShift() {
    setScheduleEdits((prev) => [...prev, { startTime: '05:00', endTime: '15:00', count: 1 }])
    setScheduleDirty(true)
  }

  function updateShift(i: number, patch: Partial<ShiftEntry>) {
    setScheduleEdits((prev) => prev.map((e, idx) => idx === i ? { ...e, ...patch } : e))
    setScheduleDirty(true)
  }

  function removeShift(i: number) {
    setScheduleEdits((prev) => prev.filter((_, idx) => idx !== i))
    setScheduleDirty(true)
  }

  function saveSchedule() {
    const cleaned = scheduleEdits.filter((e) => e.count > 0)
    const total = cleaned.reduce((s, e) => s + e.count, 0)
    const dayType = weekend ? 'weekend' : 'weekday'
    onUpdateRoster({ department: snap.department, count: total, dayType, shiftSchedule: cleaned.length > 0 ? cleaned : null })
    setScheduleEdits(cleaned)
    setScheduleDirty(false)
    setScheduleOpen(false)
  }

  function cancelSchedule() {
    setScheduleEdits(snap.shiftSchedule ?? [])
    setScheduleDirty(false)
    setScheduleOpen(false)
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
    scheduledCount: rosterCount,
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
          <span className="text-xs text-muted-foreground">
            Roster: <span className="font-semibold text-foreground">{rosterCount}</span>
          </span>
          {isSubmitted
            ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            : <Clock className="h-4 w-4 text-muted-foreground" />
          }
        </div>
      </div>

      {/* Shift schedule section */}
      <div className="mb-3">
        <button
          onClick={() => setScheduleOpen((o) => !o)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
        >
          {scheduleOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          <span>
            {weekend ? 'Weekend' : 'Weekday'} Shifts
            <span className="ml-1 text-foreground font-medium">({scheduleEdits.length} shift{scheduleEdits.length !== 1 ? 's' : ''})</span>
          </span>
        </button>

        {scheduleOpen && (
          <div className="mt-2 rounded-lg border border-border bg-muted/20 p-3 space-y-2">
            {scheduleEdits.map((e, i) => (
              <div key={i} className="rounded-md border border-border/60 bg-background px-2.5 py-2 space-y-1.5">
                {/* Time range row */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={e.startTime}
                    disabled={isPublished}
                    onChange={(ev) => updateShift(i, { startTime: ev.target.value })}
                    className="flex-1 min-w-0 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs disabled:opacity-50"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">–</span>
                  <input
                    type="time"
                    value={e.endTime}
                    disabled={isPublished}
                    onChange={(ev) => updateShift(i, { endTime: ev.target.value })}
                    className="flex-1 min-w-0 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs disabled:opacity-50"
                  />
                </div>
                {/* Count + delete row */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    value={e.count}
                    disabled={isPublished}
                    onChange={(ev) => updateShift(i, { count: Number(ev.target.value) })}
                    className="w-14 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-center disabled:opacity-50"
                    title="Headcount for this shift"
                  />
                  <span className="text-xs text-muted-foreground">people</span>
                  {!isPublished && (
                    <button onClick={() => removeShift(i)} className="ml-auto text-muted-foreground hover:text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {scheduleEdits.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No shifts defined — all headcount spans the full shift.</p>
            )}

            {!isPublished && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={addShift}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add shift
                </button>
                {scheduleDirty && (
                  <>
                    <button
                      onClick={saveSchedule}
                      className="ml-auto text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      Save schedule
                    </button>
                    <button
                      onClick={cancelSchedule}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
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
            {rosterCount} scheduled − {callouts} callouts + {ot} OT
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
