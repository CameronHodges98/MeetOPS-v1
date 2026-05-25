'use client'

import { useState } from 'react'
import { Trash2, UserPlus, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useTrainers } from '../queries'
import { useQueryClient } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

interface RemoveConfirmProps {
  trainer: { clerkId: string; displayName: string | null; activeCount: number }
  onConfirm: () => Promise<void>
  onCancel: () => void
}

function RemoveConfirmDialog({ trainer, onConfirm, onCancel }: RemoveConfirmProps) {
  const [removing, setRemoving] = useState(false)

  async function handle() {
    setRemoving(true)
    await onConfirm()
    setRemoving(false)
  }

  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onCancel() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
          <div className="flex items-start justify-between mb-4">
            <Dialog.Title className="text-base font-semibold">Remove CT access</Dialog.Title>
            <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <p className="text-sm">
              Remove <span className="font-semibold">{trainer.displayName ?? trainer.clerkId}</span> as a Certified Trainer?
            </p>
            <p className="text-sm text-muted-foreground">
              They will lose access to MeetOPS immediately. Their account is not deleted — they simply won&apos;t be able to sign in.
            </p>

            {trainer.activeCount > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <span className="font-medium">{trainer.activeCount} active session{trainer.activeCount !== 1 ? 's' : ''}</span> will need to be reassigned from the Assignments tab.
                </span>
              </div>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handle}
              disabled={removing}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {removing ? (
                <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Removing…</span>
              ) : (
                'Remove CT'
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

interface CtRosterProps {
  onInvite: () => void
}

export function CtRoster({ onInvite }: CtRosterProps) {
  const { data: trainers = [], isLoading } = useTrainers()
  const qc = useQueryClient()
  const [confirmTarget, setConfirmTarget] = useState<typeof trainers[0] | null>(null)
  const [removed, setRemoved] = useState<string[]>([])

  async function handleRemove(trainer: typeof trainers[0]) {
    const res = await fetch(`/api/coaching/trainers/${trainer.clerkId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to remove CT')
    setRemoved((prev) => [...prev, trainer.clerkId])
    setConfirmTarget(null)
    qc.invalidateQueries({ queryKey: ['coaching', 'trainers'] })
  }

  const visible = trainers.filter((t) => !removed.includes(t.clerkId))

  const scheduleLabel = (s: string | null) => {
    if (s === 'weekday') return 'Weekdays'
    if (s === 'weekend') return 'Weekends'
    if (s === 'both') return 'Any day'
    return '—'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Certified Trainers who can be assigned to coaching sessions.
        </p>
        <button
          onClick={onInvite}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Invite CT
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-muted p-8 text-center text-muted-foreground">
          <p className="font-medium mb-1">No Certified Trainers yet</p>
          <p className="text-sm">Use the Invite CT button to add one.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Email</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Availability</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Active Sessions</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Capacity</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((t) => (
                <tr key={t.clerkId} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{t.displayName ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{t.email ?? '—'}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{scheduleLabel(t.trainerSchedule)}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{t.activeCount}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      'text-xs font-medium',
                      t.availableSlots > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                    )}>
                      {t.availableSlots > 0 ? `${t.availableSlots} open` : 'Full'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setConfirmTarget(t)}
                      className="flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:border-red-400 hover:text-red-600 transition-colors ml-auto"
                      title="Remove CT access"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmTarget && (
        <RemoveConfirmDialog
          trainer={confirmTarget}
          onConfirm={() => handleRemove(confirmTarget)}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </div>
  )
}
