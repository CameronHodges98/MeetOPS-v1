'use client'

import { useState, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useTrainers, useCoachingTemplates, useCreateAssignment } from '../queries'
import type { CoachingCandidate } from '@/lib/db/schema'

interface AssignModalProps {
  candidate: CoachingCandidate | null
  onClose: () => void
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 5 || day === 6 // Sun=0, Fri=5, Sat=6
}

export function AssignModal({ candidate, onClose }: AssignModalProps) {
  const todaySchedule = isWeekend(new Date()) ? 'weekend' : 'weekday'
  const { data: trainers = [], isLoading: trainersLoading } = useTrainers(todaySchedule)
  const { data: templates = [], isLoading: templatesLoading } = useCoachingTemplates(
    candidate?.jobTitle ?? null
  )
  const { data: allTemplates = [] } = useCoachingTemplates()

  const [selectedTrainerId, setSelectedTrainerId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const createAssignment = useCreateAssignment()

  // If no templates for this specific department, show all
  const displayTemplates = templates.length > 0 ? templates : allTemplates

  const selectedTrainer = trainers.find((t) => t.clerkId === selectedTrainerId)

  async function handleSubmit() {
    if (!candidate) return
    if (!selectedTrainerId) { setError('Select a CT'); return }
    if (!selectedTemplateId) { setError('Select a template'); return }
    setError('')

    try {
      await createAssignment.mutateAsync({
        candidateId: candidate.id,
        templateId: selectedTemplateId as number,
        trainerClerkId: selectedTrainerId,
        managerNotes: notes.trim() || undefined,
      })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to assign')
    }
  }

  return (
    <Dialog.Root open={!!candidate} onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
          <div className="flex items-start justify-between mb-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">Assign Coaching</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                {candidate?.employeeName} — {candidate?.jobTitle}
              </Dialog.Description>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Metrics row */}
          {candidate && (
            <div className="mb-4 flex gap-3 rounded-lg bg-muted/50 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Avg PPH</span>
              <span className="font-semibold">{Number(candidate.avgPph ?? 0).toFixed(0)}</span>
              <span className="text-muted-foreground ml-4">Gap</span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                {Number(candidate.avgGapPct ?? 0).toFixed(1)}%
              </span>
              <span className="text-muted-foreground ml-4">Manager</span>
              <span className="font-medium">{candidate.managerName}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* CT selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Certified Trainer ({todaySchedule} — {new Date().toLocaleDateString('en-US', { weekday: 'long' })})
              </label>
              {trainersLoading ? (
                <div className="h-9 rounded-md bg-muted animate-pulse" />
              ) : trainers.length === 0 ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  No {todaySchedule} CTs available with open slots. Try reassigning an existing session first.
                </p>
              ) : (
                <div className="grid gap-2">
                  {trainers.map((t) => (
                    <button
                      key={t.clerkId}
                      onClick={() => setSelectedTrainerId(t.clerkId)}
                      disabled={t.availableSlots <= 0}
                      className={cn(
                        'flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors text-left',
                        selectedTrainerId === t.clerkId
                          ? 'border-primary bg-primary/10'
                          : t.availableSlots > 0
                          ? 'border-border hover:border-primary/50 hover:bg-muted'
                          : 'border-border bg-muted/30 opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div>
                        <span className="font-medium">{t.displayName ?? t.clerkId}</span>
                        {t.trainerSchedule && (
                          <span className="ml-2 text-xs text-muted-foreground capitalize">({t.trainerSchedule})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'text-xs font-medium',
                          t.availableSlots > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                        )}>
                          {t.availableSlots > 0 ? `${t.availableSlots} slot${t.availableSlots !== 1 ? 's' : ''}` : 'Full'}
                        </span>
                        <span className="text-xs text-muted-foreground">{t.activeCount}/5 active</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Template selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Coaching Template
              </label>
              {templatesLoading ? (
                <div className="h-9 rounded-md bg-muted animate-pulse" />
              ) : (
                <div className="relative">
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value ? Number(e.target.value) : '')}
                    className="h-9 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-8 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Select template…</option>
                    {displayTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.department})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Manager notes */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Notes for CT (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Context about the employee, specific areas to focus on…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={createAssignment.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {createAssignment.isPending ? 'Assigning…' : 'Assign CT'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
