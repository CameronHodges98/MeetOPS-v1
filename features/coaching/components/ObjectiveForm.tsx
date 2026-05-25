'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useUpdateAssignment } from '../queries'
import type { AssignmentWithDetails } from '../queries'

interface Objective {
  id: string
  text: string
}

interface ObjectiveResult {
  objectiveId: string
  result: 'understands' | 'bottleneck'
  comment?: string
}

interface ObjectiveFormProps {
  assignment: AssignmentWithDetails
  onDone?: () => void
}

export function ObjectiveForm({ assignment, onDone }: ObjectiveFormProps) {
  const objectives = (assignment.templateObjectives as Objective[] | null) ?? []
  const existingResults = (assignment.objectiveResults as ObjectiveResult[] | null) ?? []

  const [results, setResults] = useState<Record<string, ObjectiveResult>>(
    Object.fromEntries(existingResults.map((r) => [r.objectiveId, r]))
  )
  const [summaryNotes, setSummaryNotes] = useState(assignment.ctSummaryNotes ?? '')
  const [expandedComment, setExpandedComment] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const updateAssignment = useUpdateAssignment()
  const isReadOnly = assignment.status === 'complete'

  function setResult(objId: string, result: 'understands' | 'bottleneck') {
    setResults((prev) => {
      const next = { ...prev }
      if (next[objId]?.result === result) {
        // Toggle off
        delete next[objId]
      } else {
        next[objId] = { objectiveId: objId, result, comment: prev[objId]?.comment }
      }
      return next
    })
    if (result === 'bottleneck') setExpandedComment(objId)
  }

  function setComment(objId: string, comment: string) {
    setResults((prev) => ({
      ...prev,
      [objId]: { ...prev[objId], objectiveId: objId, result: prev[objId]?.result ?? 'bottleneck', comment },
    }))
  }

  const allAnswered = objectives.every((o) => results[o.id])
  const hasBottleneckWithoutComment = Object.values(results).some(
    (r) => r.result === 'bottleneck' && !r.comment?.trim()
  )

  async function handleSubmit() {
    setSaving(true)
    try {
      await updateAssignment.mutateAsync({
        id: assignment.id,
        status: 'pending_review',
        objectiveResults: Object.values(results),
        ctSummaryNotes: summaryNotes.trim() || undefined,
      })
      onDone?.()
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveDraft() {
    setSaving(true)
    try {
      await updateAssignment.mutateAsync({
        id: assignment.id,
        status: 'in_progress',
        objectiveResults: Object.values(results),
        ctSummaryNotes: summaryNotes.trim() || undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  if (objectives.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No objectives defined in this template.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Objective list */}
      <div className="space-y-3">
        {objectives.map((obj) => {
          const result = results[obj.id]
          const isBottleneck = result?.result === 'bottleneck'
          const isUnderstands = result?.result === 'understands'
          const showComment = isBottleneck || expandedComment === obj.id

          return (
            <div
              key={obj.id}
              className={cn(
                'rounded-lg border p-3 transition-colors',
                isUnderstands && 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20',
                isBottleneck && 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20',
                !result && 'border-border'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm flex-1">{obj.text}</p>
                {!isReadOnly && (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => setResult(obj.id, 'understands')}
                      title="Understands"
                      className={cn(
                        'flex items-center justify-center h-8 w-8 rounded-md border transition-colors',
                        isUnderstands
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-border text-muted-foreground hover:border-green-400 hover:text-green-600'
                      )}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setResult(obj.id, 'bottleneck')}
                      title="Bottleneck — requires comment"
                      className={cn(
                        'flex items-center justify-center h-8 w-8 rounded-md border transition-colors',
                        isBottleneck
                          ? 'bg-red-500 border-red-500 text-white'
                          : 'border-border text-muted-foreground hover:border-red-400 hover:text-red-600'
                      )}
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                    {!isBottleneck && (
                      <button
                        onClick={() => setExpandedComment(expandedComment === obj.id ? null : obj.id)}
                        title="Add comment"
                        className="flex items-center justify-center h-8 w-8 rounded-md border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {showComment && !isReadOnly && (
                <textarea
                  value={result?.comment ?? ''}
                  onChange={(e) => setComment(obj.id, e.target.value)}
                  rows={2}
                  placeholder={isBottleneck ? 'Describe the bottleneck (required)…' : 'Optional note…'}
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              )}

              {isReadOnly && result?.comment && (
                <p className="mt-2 text-xs text-muted-foreground italic">{result.comment}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary notes */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Overall Session Notes
        </label>
        {isReadOnly ? (
          <p className="text-sm text-muted-foreground">{summaryNotes || '—'}</p>
        ) : (
          <textarea
            value={summaryNotes}
            onChange={(e) => setSummaryNotes(e.target.value)}
            rows={3}
            placeholder="Overall observations, context for the manager…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        )}
      </div>

      {/* Actions */}
      {!isReadOnly && (
        <div className="flex justify-between items-center">
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !allAnswered || hasBottleneckWithoutComment}
            title={!allAnswered ? 'Answer all objectives first' : hasBottleneckWithoutComment ? 'Add comments for all bottlenecks' : ''}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Submitting…' : 'Submit to Manager'}
          </button>
        </div>
      )}
    </div>
  )
}
