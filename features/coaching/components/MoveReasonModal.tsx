'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { STAGE_CONFIG } from '../constants'
import type { EscalationStage } from '@/lib/db/schema'
import type { BoardStage } from '../constants'

interface Props {
  open: boolean
  employeeName: string
  fromStage: EscalationStage
  toStage: EscalationStage
  onConfirm: (reason: string) => void
  onCancel: () => void
  isLoading?: boolean
}

export function MoveReasonModal({ open, employeeName, fromStage, toStage, onConfirm, onCancel, isLoading }: Props) {
  const [reason, setReason] = useState('')

  const fromLabel = fromStage === 'roster' ? 'Roster' : STAGE_CONFIG[fromStage as BoardStage]?.label ?? fromStage
  const toLabel = toStage === 'roster' ? 'Roster' : STAGE_CONFIG[toStage as BoardStage]?.label ?? toStage

  const handleConfirm = () => {
    if (!reason.trim()) return
    onConfirm(reason.trim())
    setReason('')
  }

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border rounded-xl shadow-xl p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold">Request Stage Move</Dialog.Title>
              <p className="text-sm text-muted-foreground mt-0.5">
                {employeeName} — <span className="font-medium">{fromLabel}</span> → <span className="font-medium">{toLabel}</span>
              </p>
            </div>
            <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason for move <span className="text-red-500">*</span></label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this employee should be moved to a different stage…"
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">This reason will be sent to your Operations Manager for approval.</p>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm rounded-md border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!reason.trim() || isLoading}
              className={cn(
                'px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground transition-colors',
                (!reason.trim() || isLoading) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/90'
              )}
            >
              {isLoading ? 'Submitting…' : 'Submit for Approval'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
