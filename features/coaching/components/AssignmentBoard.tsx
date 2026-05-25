'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Clock, AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useCoachingAssignments, useUpdateAssignment, AssignmentWithDetails } from '../queries'
import { useCoachingStore } from '../store'
import { ObjectiveForm } from './ObjectiveForm'
import { format, isAfter, parseISO } from 'date-fns'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

const STATUS_TABS = [
  { key: 'assigned',        label: 'Assigned',       color: 'text-blue-600 dark:text-blue-400' },
  { key: 'in_progress',     label: 'In Progress',    color: 'text-amber-600 dark:text-amber-400' },
  { key: 'pending_review',  label: 'Pending Review', color: 'text-purple-600 dark:text-purple-400' },
  { key: 'complete',        label: 'Complete',       color: 'text-green-600 dark:text-green-400' },
] as const

function isOverdue(dueAt: string | null | undefined): boolean {
  if (!dueAt) return false
  return isAfter(new Date(), parseISO(String(dueAt)))
}

interface AssignmentCardProps {
  assignment: AssignmentWithDetails
  onOpenForm: (a: AssignmentWithDetails) => void
  onMarkComplete: (a: AssignmentWithDetails) => void
}

function AssignmentCard({ assignment: a, onOpenForm, onMarkComplete }: AssignmentCardProps) {
  const overdueCt = a.status === 'assigned' && isOverdue(a.dueCtAt?.toString())
  const overdueManager = a.status === 'pending_review' && isOverdue(a.dueManagerAt?.toString())

  return (
    <div className={cn(
      'rounded-xl border bg-card p-4 shadow-sm space-y-3',
      (overdueCt || overdueManager) && 'border-red-300 dark:border-red-800'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm">{a.employeeName}</p>
          <p className="text-xs text-muted-foreground">{a.jobTitle ?? '—'} · {a.managerName}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-muted-foreground">PPH</p>
          <p className="font-bold tabular-nums">{Number(a.avgPph ?? 0).toFixed(0)}</p>
        </div>
      </div>

      <div className="flex gap-3 text-xs">
        <span className="text-muted-foreground">Template</span>
        <span className="font-medium">{a.templateName}</span>
        <span className="text-muted-foreground ml-2">CT</span>
        <span className="font-medium">{a.trainerName ?? a.trainerClerkId.slice(0, 8)}</span>
      </div>

      {/* Due / overdue */}
      {(a.status === 'assigned' || a.status === 'in_progress') && a.dueCtAt && (
        <div className={cn('flex items-center gap-1 text-xs', overdueCt ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
          {overdueCt && <AlertTriangle className="h-3.5 w-3.5" />}
          <Clock className="h-3 w-3" />
          CT due {format(parseISO(String(a.dueCtAt)), 'MMM d, h:mm a')}
          {overdueCt && ' — OVERDUE'}
        </div>
      )}
      {a.status === 'pending_review' && a.dueManagerAt && (
        <div className={cn('flex items-center gap-1 text-xs', overdueManager ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
          {overdueManager && <AlertTriangle className="h-3.5 w-3.5" />}
          <Clock className="h-3 w-3" />
          Manager review due {format(parseISO(String(a.dueManagerAt)), 'MMM d, h:mm a')}
          {overdueManager && ' — OVERDUE'}
        </div>
      )}
      {a.status === 'complete' && a.completedAt && (
        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Completed {format(parseISO(String(a.completedAt)), 'MMM d, yyyy')}
        </div>
      )}

      {/* Manager notes */}
      {a.managerNotes && (
        <p className="text-xs text-muted-foreground border-l-2 border-border pl-2 italic">{a.managerNotes}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {(a.status === 'assigned' || a.status === 'in_progress') && (
          <button
            onClick={() => onOpenForm(a)}
            className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {a.status === 'assigned' ? 'Start Form' : 'Continue Form'}
          </button>
        )}
        {a.status === 'pending_review' && (
          <>
            <button
              onClick={() => onOpenForm(a)}
              className="flex-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
            >
              View Submission
            </button>
            <button
              onClick={() => onMarkComplete(a)}
              className="flex-1 rounded-md bg-green-600 dark:bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
            >
              Mark Complete
            </button>
          </>
        )}
        {a.status === 'complete' && (
          <button
            onClick={() => onOpenForm(a)}
            className="flex-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
          >
            View Results
          </button>
        )}
      </div>
    </div>
  )
}

export function AssignmentBoard() {
  const { statusFilter, setStatusFilter } = useCoachingStore()
  const activeTab = statusFilter ?? 'assigned'

  const { data: assignments = [], isLoading } = useCoachingAssignments(
    statusFilter ? { status: statusFilter } : {}
  )

  const { data: allAssignments = [] } = useCoachingAssignments({})

  const countsByStatus = STATUS_TABS.map((s) => ({
    key: s.key,
    count: allAssignments.filter((a) => a.status === s.key).length,
  }))

  const [formAssignment, setFormAssignment] = useState<AssignmentWithDetails | null>(null)
  const updateAssignment = useUpdateAssignment()

  async function handleMarkComplete(a: AssignmentWithDetails) {
    await updateAssignment.mutateAsync({ id: a.id, status: 'complete' })
  }

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
        {STATUS_TABS.map((tab) => {
          const count = countsByStatus.find((c) => c.key === tab.key)?.count ?? 0
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                'flex items-center gap-1.5 flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                isActive ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-xs leading-none',
                  isActive ? tab.color : 'text-muted-foreground'
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Assignment grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-muted p-8 text-center text-muted-foreground">
          No {STATUS_TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} assignments.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {assignments.map((a) => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              onOpenForm={setFormAssignment}
              onMarkComplete={handleMarkComplete}
            />
          ))}
        </div>
      )}

      {/* Objective form modal */}
      <Dialog.Root open={!!formAssignment} onOpenChange={(open) => { if (!open) setFormAssignment(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <Dialog.Title className="text-lg font-semibold">
                  {formAssignment?.templateName}
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                  {formAssignment?.employeeName} · {formAssignment?.managerName}
                  {formAssignment?.status === 'complete' && ' · Read-only'}
                </Dialog.Description>
              </div>
              <button onClick={() => setFormAssignment(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formAssignment && (
              <ObjectiveForm
                assignment={formAssignment}
                onDone={() => setFormAssignment(null)}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
