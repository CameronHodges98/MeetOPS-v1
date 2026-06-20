'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Play, CheckCircle2, Check, AlertCircle, ClipboardList, Clock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { STAGE_CONFIG, type BoardStage } from '../../constants'
import { useChecklists, useUpdateSession } from '../../queries'
import type { CTSession, ChecklistItem, ChecklistResult } from '../../queries'
import { CT_STATUS_META } from './CTSessionCard'

interface Props {
  session: CTSession | null
  onClose: () => void
}

export function CTObservationPanel({ session, onClose }: Props) {
  const { data: templates } = useChecklists()
  const update = useUpdateSession()

  const [templateId, setTemplateId] = useState<number | null>(null)
  const [results, setResults] = useState<Record<string, ChecklistResult>>({})
  const [ctNotes, setCtNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Reset local form state whenever a different session is opened.
  useEffect(() => {
    if (!session) return
    setTemplateId(session.checklistTemplateId ?? null)
    setCtNotes(session.ctNotes ?? '')
    setError(null)
    const stored = Array.isArray(session.formData) ? session.formData as ChecklistResult[] : []
    setResults(Object.fromEntries(stored.map((r) => [r.id, r])))
  }, [session])

  const selectedTemplate = useMemo(
    () => (templates ?? []).find((t) => t.id === templateId) ?? null,
    [templates, templateId]
  )
  const items = useMemo<ChecklistItem[]>(
    () => (Array.isArray(selectedTemplate?.items) ? selectedTemplate!.items as ChecklistItem[] : []),
    [selectedTemplate]
  )

  if (!session) return null

  const meta = CT_STATUS_META[session.status] ?? CT_STATUS_META.unassigned
  const stageCfg = session.escalationStage !== 'roster'
    ? STAGE_CONFIG[session.escalationStage as BoardStage]
    : null
  const readOnly = session.status === 'review' || session.status === 'complete'

  const setItem = (id: string, result: 'pass' | 'fail') =>
    setResults((prev) => ({ ...prev, [id]: { id, result, comment: prev[id]?.comment } }))
  const setComment = (id: string, comment: string) =>
    setResults((prev) => ({ ...prev, [id]: { id, result: prev[id]?.result ?? 'pass', comment } }))

  const handleStart = () => {
    update.mutate({ id: session.id, body: { status: 'in_coaching' } })
  }

  const handleSubmit = () => {
    if (!selectedTemplate) { setError('Select a checklist first.'); return }
    const unanswered = items.filter((i) => !results[i.id]?.result)
    if (unanswered.length > 0) { setError(`Mark every item — ${unanswered.length} still blank.`); return }
    setError(null)
    const formData: ChecklistResult[] = items.map((i) => ({
      id: i.id,
      result: results[i.id].result,
      comment: results[i.id].comment?.trim() || undefined,
    }))
    update.mutate(
      { id: session.id, body: { status: 'review', formData, ctNotes, checklistTemplateId: selectedTemplate.id } },
      { onSuccess: onClose }
    )
  }

  // Group checklist items by category for display.
  const grouped = items.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item)
    return acc
  }, {})

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      <div className="fixed top-0 right-0 bottom-0 w-full max-w-[480px] bg-background border-l z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b">
          <div className="h-11 w-11 flex-shrink-0 rounded-full border-2 border-border bg-muted flex items-center justify-center font-bold text-muted-foreground">
            {session.employeeName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold leading-tight truncate">{session.employeeName}</h2>
            <p className="text-sm text-muted-foreground">{session.jobTitle} · {session.managerName}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Stage + status */}
          <div className="flex items-center gap-2 flex-wrap">
            {stageCfg && (
              <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', stageCfg.badge)}>
                {stageCfg.label}
              </span>
            )}
            <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', meta.badge)}>
              {meta.label}
            </span>
          </div>

          {/* Why they're here */}
          {(session.triggerPph !== null || session.triggerGapPct !== null) && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Why this employee was flagged</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'PPH', value: session.triggerPph !== null ? Math.round(session.triggerPph) : '—' },
                  { label: 'Gap %', value: session.triggerGapPct !== null ? `${Math.round(session.triggerGapPct)}%` : '—' },
                  { label: 'Direct %', value: session.triggerDirectPct !== null ? `${Math.round(session.triggerDirectPct)}%` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg font-bold">{value}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-1">Week of {session.weekDate}</p>
            </div>
          )}

          {/* ── ASSIGNED: start coaching ─────────────────────────── */}
          {session.status === 'assigned' && (
            <div className="rounded-lg border border-dashed p-5 text-center space-y-3">
              <Clock className="h-8 w-8 mx-auto text-muted-foreground" />
              <div>
                <p className="font-medium">Ready to coach</p>
                <p className="text-sm text-muted-foreground">
                  Start the session when you sit down with {session.employeeName.split(' ')[0]} on the floor.
                </p>
              </div>
              <button
                onClick={handleStart}
                disabled={update.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                <Play className="h-4 w-4" />
                Start Coaching
              </button>
            </div>
          )}

          {/* ── IN_COACHING: observation form ────────────────────── */}
          {session.status === 'in_coaching' && (
            <div className="space-y-4">
              {/* Checklist picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5" /> Observation checklist
                </label>
                <select
                  value={templateId ?? ''}
                  onChange={(e) => { setTemplateId(e.target.value ? Number(e.target.value) : null); setError(null) }}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select a checklist…</option>
                  {(templates ?? []).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Items grouped by category */}
              {selectedTemplate && Object.entries(grouped).map(([category, catItems]) => (
                <div key={category} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</p>
                  {catItems.map((item) => {
                    const res = results[item.id]
                    return (
                      <div key={item.id} className="rounded-lg border p-3 space-y-2">
                        <p className="text-sm leading-snug">{item.text}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setItem(item.id, 'pass')}
                            className={cn(
                              'flex-1 flex items-center justify-center gap-1 rounded-md border py-1.5 text-xs font-medium transition-colors',
                              res?.result === 'pass'
                                ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : 'border-input text-muted-foreground hover:bg-muted'
                            )}
                          >
                            <Check className="h-3.5 w-3.5" /> Pass
                          </button>
                          <button
                            onClick={() => setItem(item.id, 'fail')}
                            className={cn(
                              'flex-1 flex items-center justify-center gap-1 rounded-md border py-1.5 text-xs font-medium transition-colors',
                              res?.result === 'fail'
                                ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                : 'border-input text-muted-foreground hover:bg-muted'
                            )}
                          >
                            <X className="h-3.5 w-3.5" /> Needs work
                          </button>
                        </div>
                        {res?.result === 'fail' && (
                          <input
                            value={res.comment ?? ''}
                            onChange={(e) => setComment(item.id, e.target.value)}
                            placeholder="What did you observe? (optional)"
                            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}

              {/* CT notes */}
              {selectedTemplate && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Trainer notes (sent to manager)</label>
                  <textarea
                    value={ctNotes}
                    onChange={(e) => setCtNotes(e.target.value)}
                    rows={3}
                    placeholder="Summary of the conversation, what you worked on, follow-up needed…"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              {error && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="h-3.5 w-3.5" /> {error}
                </div>
              )}
            </div>
          )}

          {/* ── REVIEW / COMPLETE: read-only summary ─────────────── */}
          {readOnly && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                {session.status === 'review' ? (
                  <p className="text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Submitted — waiting on the manager to review and close out.
                  </p>
                ) : (
                  <p className="text-green-700 dark:text-green-300 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Completed{session.completedAt ? ` ${new Date(session.completedAt).toLocaleDateString()}` : ''}.
                  </p>
                )}
              </div>

              <SubmittedChecklist session={session} items={items} results={results} />

              {session.ctNotes && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium mb-1">Your notes</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{session.ctNotes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — submit */}
        {session.status === 'in_coaching' && selectedTemplate && (
          <div className="border-t p-4">
            <button
              onClick={handleSubmit}
              disabled={update.isPending}
              className="flex items-center gap-1.5 w-full justify-center rounded-md bg-green-600 hover:bg-green-700 text-white px-3 py-2.5 text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
              {update.isPending ? 'Submitting…' : 'Submit for Manager Review'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function SubmittedChecklist({
  session, items, results,
}: { session: CTSession; items: ChecklistItem[]; results: Record<string, ChecklistResult> }) {
  // Prefer the live template item text; fall back to the stored result ids.
  const stored = Array.isArray(session.formData) ? session.formData as ChecklistResult[] : []
  const rows = items.length > 0
    ? items.map((i) => ({ text: i.text, res: results[i.id] }))
    : stored.map((r) => ({ text: r.id, res: r }))

  if (rows.length === 0) return null

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observation</p>
      {rows.map((row, i) => (
        <div key={i} className="flex items-start gap-2 text-sm">
          {row.res?.result === 'fail'
            ? <X className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            : <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />}
          <div className="min-w-0">
            <p className="leading-snug">{row.text}</p>
            {row.res?.comment && <p className="text-xs text-muted-foreground italic">{row.res.comment}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
