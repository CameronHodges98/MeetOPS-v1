'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { STAGE_CONFIG } from '../constants'
import { useCoachingApprovals, useReviewApproval } from '../queries'
import type { BoardStage } from '../constants'
import type { EscalationStage } from '@/lib/db/schema'

function stageLabel(stage: EscalationStage | null | undefined) {
  if (!stage || stage === 'roster') return 'Roster'
  return STAGE_CONFIG[stage as BoardStage]?.label ?? stage
}

const TYPE_LABEL: Record<string, string> = {
  manual_move: 'Stage Move',
  exempt: 'Exemption',
}

export function ApprovalsInbox() {
  const { data, isLoading } = useCoachingApprovals()
  const reviewMutation = useReviewApproval()
  const [expanded, setExpanded] = useState(true)
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({})
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set())

  const pending = data ?? []

  const handle = async (id: number, decision: 'approved' | 'denied') => {
    setProcessingIds((prev) => new Set(prev).add(id))
    await reviewMutation.mutateAsync({ id, decision, reviewNotes: reviewNotes[id] })
    setProcessingIds((prev) => { const s = new Set(prev); s.delete(id); return s })
    setReviewNotes((prev) => { const n = { ...prev }; delete n[id]; return n })
  }

  if (isLoading || pending.length === 0) return null

  return (
    <div className="rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="font-semibold text-sm text-amber-800 dark:text-amber-200">
            Pending Approvals
          </span>
          <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-amber-500 text-white text-xs font-bold px-1.5">
            {pending.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-amber-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-amber-600" />
        )}
      </button>

      {expanded && (
        <div className="divide-y divide-amber-200 dark:divide-amber-800">
          {pending.map(({ approval, entry }) => (
            <div key={approval.id} className="px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{entry.employeeName}</span>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      approval.type === 'auto_advance' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                      approval.type === 'exempt' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                      'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                    )}>
                      {TYPE_LABEL[approval.type]}
                    </span>
                    {approval.toStage && (
                      <span className="text-xs text-muted-foreground">
                        {stageLabel(approval.fromStage)} → {stageLabel(approval.toStage)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 italic">"{approval.reason}"</p>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handle(approval.id, 'approved')}
                    disabled={processingIds.has(approval.id)}
                    className="flex items-center gap-1 rounded-md bg-green-600 hover:bg-green-700 text-white px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={() => handle(approval.id, 'denied')}
                    disabled={processingIds.has(approval.id)}
                    className="flex items-center gap-1 rounded-md border border-red-300 hover:bg-red-50 text-red-600 px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 dark:border-red-700 dark:hover:bg-red-900/20"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Deny
                  </button>
                </div>
              </div>

              {/* Optional review note */}
              <input
                value={reviewNotes[approval.id] ?? ''}
                onChange={(e) => setReviewNotes((prev) => ({ ...prev, [approval.id]: e.target.value }))}
                placeholder="Add a note (optional)…"
                className="w-full rounded border border-amber-200 dark:border-amber-700 bg-white dark:bg-background px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
