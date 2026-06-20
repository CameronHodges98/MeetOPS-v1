'use client'

import { useState } from 'react'
import { X, Clock, CheckCircle2, TrendingDown, User, Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { STAGE_CONFIG, CARD_STATUS_STYLE } from '../constants'
import { useCTs, useUpdateSession, useSetCardStatus, useChecklists } from '../queries'
import type { RosterEntryWithDetails, ChecklistItem, ChecklistResult } from '../queries'
import type { CoachingSession } from '@/lib/db/schema'
import type { BoardStage } from '../constants'
import type { EscalationStage } from '@/lib/db/schema'
import { useUser } from '@clerk/nextjs'
import type { AppRole } from '@/config/roles'

interface Props {
  entry: RosterEntryWithDetails | null
  onClose: () => void
  onRequestMove: (toStage: EscalationStage) => void
}

function stageLabel(stage: EscalationStage) {
  if (stage === 'roster') return 'Roster'
  return STAGE_CONFIG[stage as BoardStage]?.label ?? stage
}

const SESSION_STATUS_LABELS: Record<string, string> = {
  unassigned: 'Awaiting CT Assignment',
  assigned: 'CT Assigned',
  in_coaching: 'In Coaching',
  review: 'Manager Review',
  complete: 'Complete',
}

export function EmployeeDrawer({ entry, onClose, onRequestMove }: Props) {
  const { user } = useUser()
  const role = (user?.publicMetadata as Record<string, unknown>)?.role as AppRole | undefined
  const canDirectMove = role && ['root', 'gm', 'ops'].includes(role)

  const { data: cts } = useCTs()
  const { data: checklistTemplates } = useChecklists()
  const updateSession = useUpdateSession()
  const setStatus = useSetCardStatus()

  const [selectedCt, setSelectedCt] = useState('')
  const [managerNotes, setManagerNotes] = useState('')
  const [exemptReason, setExemptReason] = useState('')
  const [showExemptForm, setShowExemptForm] = useState(false)

  if (!entry) return null

  const currentSession = entry.sessions.find((s) => s.escalationStage === entry.currentStage)
  const history = Array.isArray(entry.stageHistory) ? entry.stageHistory as Array<{
    stage: string; changedAt: string; reason: string; type: string
  }> : []

  const handleAssignCT = () => {
    if (!currentSession || !selectedCt) return
    updateSession.mutate({ id: currentSession.id, body: { assignedCtClerkId: selectedCt } })
  }

  const handleMarkComplete = () => {
    if (!currentSession) return
    updateSession.mutate({ id: currentSession.id, body: { status: 'complete', managerNotes } })
  }

  const handleExempt = () => {
    if (!exemptReason.trim()) return
    setStatus.mutate({ id: entry.id, cardStatus: 'exempt', reason: exemptReason })
    setShowExemptForm(false)
    setExemptReason('')
  }

  const isInProgression = entry.currentStage !== 'roster'
  const stageCfg = isInProgression ? STAGE_CONFIG[entry.currentStage as BoardStage] : null
  const statusStyle = CARD_STATUS_STYLE[entry.cardStatus]

  // Read-only render of the checklist the CT submitted (formData), resolving
  // item text from the template the CT used.
  const renderObservation = (session: CoachingSession) => {
    const stored = Array.isArray(session.formData) ? session.formData as ChecklistResult[] : []
    if (stored.length === 0) return null
    const tmpl = (checklistTemplates ?? []).find((t) => t.id === session.checklistTemplateId)
    const items = Array.isArray(tmpl?.items) ? tmpl!.items as ChecklistItem[] : []
    const textById = new Map(items.map((i) => [i.id, i.text]))
    return (
      <div className="rounded border bg-muted/30 p-2.5 space-y-1.5">
        <p className="text-xs font-medium">CT Observation{tmpl ? ` · ${tmpl.name}` : ''}</p>
        {stored.map((r) => (
          <div key={r.id} className="flex items-start gap-2 text-xs">
            {r.result === 'fail'
              ? <X className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
              : <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />}
            <div className="min-w-0">
              <p>{textById.get(r.id) ?? r.id}</p>
              {r.comment && <p className="text-muted-foreground italic">{r.comment}</p>}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-[420px] bg-background border-l z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b">
          <div className="h-11 w-11 flex-shrink-0 rounded-full border-2 border-border bg-muted flex items-center justify-center font-bold text-muted-foreground">
            {entry.employeeName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold leading-tight truncate">{entry.employeeName}</h2>
            <p className="text-sm text-muted-foreground">{entry.jobTitle} · {entry.managerName}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Current stage + status */}
          <div className="flex items-center gap-2 flex-wrap">
            {stageCfg ? (
              <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', stageCfg.badge)}>
                {stageCfg.label}
              </span>
            ) : (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                Roster
              </span>
            )}
            <span className={cn(
              'flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border',
              entry.cardStatus === 'completed' ? 'border-green-300 text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-900/20' :
              entry.cardStatus === 'exempt' ? 'border-red-300 text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/20' :
              'border-yellow-300 text-yellow-700 bg-yellow-50 dark:text-yellow-300 dark:bg-yellow-900/20'
            )}>
              <span className={cn('h-1.5 w-1.5 rounded-full', statusStyle.dot)} />
              {statusStyle.label}
            </span>
            {entry.consecutiveWeeksFlagged > 0 && (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <TrendingDown className="h-3 w-3" />
                {entry.consecutiveWeeksFlagged} week{entry.consecutiveWeeksFlagged !== 1 ? 's' : ''} flagged
              </span>
            )}
          </div>

          {/* Trigger metrics */}
          {(entry.triggerPph !== null || entry.triggerGapPct !== null) && (
            <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-3 gap-3">
              {[
                { label: 'PPH', value: entry.triggerPph !== null ? Math.round(entry.triggerPph) : '—', flagged: (entry.triggerPph ?? 101) < 100 },
                { label: 'Gap %', value: entry.triggerGapPct !== null ? `${Math.round(entry.triggerGapPct)}%` : '—', flagged: (entry.triggerGapPct ?? 0) > 10 },
                { label: 'Direct %', value: entry.triggerDirectPct !== null ? `${Math.round(entry.triggerDirectPct)}%` : '—', flagged: false },
              ].map(({ label, value, flagged }) => (
                <div key={label} className="text-center">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={cn('text-lg font-bold', flagged ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>
                    {value}
                  </p>
                </div>
              ))}
              <p className="col-span-3 text-[10px] text-muted-foreground text-center">Trigger metrics from week of {entry.firstFlaggedWeekDate}</p>
            </div>
          )}

          {/* Coaching session panel */}
          {isInProgression && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Coaching Session</h3>
                {currentSession && (
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    currentSession.status === 'complete' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                    currentSession.status === 'review' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                    currentSession.status === 'in_coaching' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
                    currentSession.status === 'assigned' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {SESSION_STATUS_LABELS[currentSession.status] ?? currentSession.status}
                  </span>
                )}
              </div>

              {currentSession?.status === 'unassigned' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Assign a Certified Trainer</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedCt}
                      onChange={(e) => setSelectedCt(e.target.value)}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select CT…</option>
                      {(cts ?? []).map((ct) => (
                        <option key={ct.clerkId} value={ct.clerkId}>
                          {ct.name ?? ct.email}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAssignCT}
                      disabled={!selectedCt || updateSession.isPending}
                      className="flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
                    >
                      <User className="h-3.5 w-3.5" />
                      Assign
                    </button>
                  </div>
                </div>
              )}

              {currentSession?.status === 'assigned' && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  CT assigned — waiting for coaching to begin
                </div>
              )}

              {currentSession?.status === 'in_coaching' && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  Coaching in progress
                </div>
              )}

              {currentSession?.status === 'review' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">CT has submitted their observation. Review with the employee and add notes, then mark complete.</p>
                  {renderObservation(currentSession)}
                  {currentSession.ctNotes && (
                    <div className="rounded border bg-muted/30 p-2.5">
                      <p className="text-xs font-medium mb-1">CT Notes</p>
                      <p className="text-xs text-muted-foreground">{currentSession.ctNotes}</p>
                    </div>
                  )}
                  <textarea
                    value={managerNotes}
                    onChange={(e) => setManagerNotes(e.target.value)}
                    placeholder="Manager notes after review…"
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={handleMarkComplete}
                    disabled={updateSession.isPending}
                    className="flex items-center gap-1.5 w-full justify-center rounded-md bg-green-600 hover:bg-green-700 text-white px-3 py-2 text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark Complete
                  </button>
                </div>
              )}

              {currentSession?.status === 'complete' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Session completed {currentSession.completedAt ? new Date(currentSession.completedAt).toLocaleDateString() : ''}
                  </div>
                  {renderObservation(currentSession)}
                  {currentSession.ctNotes && (
                    <div className="rounded border bg-muted/30 p-2.5">
                      <p className="text-xs font-medium mb-1">CT Notes</p>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{currentSession.ctNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Exempt action */}
          {entry.cardStatus !== 'exempt' && (
            <div>
              {!showExemptForm ? (
                <button
                  onClick={() => setShowExemptForm(true)}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                >
                  Mark as exempt…
                </button>
              ) : (
                <div className="rounded-lg border border-red-200 dark:border-red-800 p-3 space-y-2">
                  <p className="text-xs font-medium text-red-700 dark:text-red-400">Request exemption</p>
                  <textarea
                    value={exemptReason}
                    onChange={(e) => setExemptReason(e.target.value)}
                    placeholder="Reason for exemption (required)…"
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowExemptForm(false)}
                      className="px-3 py-1.5 text-xs rounded-md border hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleExempt}
                      disabled={!exemptReason.trim() || setStatus.isPending}
                      className="px-3 py-1.5 text-xs rounded-md bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                    >
                      {canDirectMove ? 'Exempt' : 'Submit for Approval'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stage history */}
          {history.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</h3>
              <div className="space-y-0">
                {[...history].reverse().map((h, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="h-2.5 w-2.5 rounded-full border-2 border-border bg-background mt-1" />
                      {i < history.length - 1 && <div className="w-0.5 h-6 bg-border" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium leading-tight">{stageLabel(h.stage as EscalationStage)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(h.changedAt).toLocaleDateString()} · {h.type}
                      </p>
                      {h.reason && <p className="text-xs text-muted-foreground italic mt-0.5">"{h.reason}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer — stage move actions */}
        {isInProgression && entry.cardStatus !== 'completed' && (
          <div className="border-t p-4">
            <p className="text-xs text-muted-foreground mb-2">
              {canDirectMove ? 'Move to stage:' : 'Request stage change:'}
            </p>
            <div className="flex flex-wrap gap-2">
              {(['c1', 'c2', 'k1', 'k2', 'final'] as const).filter((s) => s !== entry.currentStage).map((stage) => (
                <button
                  key={stage}
                  onClick={() => onRequestMove(stage)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full border transition-colors hover:opacity-80',
                    STAGE_CONFIG[stage].badge
                  )}
                >
                  {STAGE_CONFIG[stage].label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
