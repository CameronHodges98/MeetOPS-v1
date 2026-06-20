'use client'

import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useQueryClient } from '@tanstack/react-query'

interface ImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type UploadType = 'coaching_performance'

const UPLOAD_TYPES: { id: UploadType; label: string; desc: string; accept: string }[] = [
  {
    id: 'coaching_performance',
    label: 'Performance CSV',
    desc: 'Weekly performance export — populates the coaching board with flagged employees.',
    accept: '.csv',
  },
]

type Status = { type: 'idle' } | { type: 'loading' } | { type: 'success'; message: string } | { type: 'error'; message: string }

export function ImportModal({ open, onOpenChange }: ImportModalProps) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedType, setSelectedType] = useState<UploadType>('coaching_performance')
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState<Status>({ type: 'idle' })

  const reset = () => {
    setStatus({ type: 'idle' })
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleClose = (v: boolean) => {
    if (!v) reset()
    onOpenChange(v)
  }

  const upload = async (file: File) => {
    setStatus({ type: 'loading' })
    try {
      const fd = new FormData()
      fd.append('file', file)

      let endpoint = ''
      if (selectedType === 'coaching_performance') endpoint = '/api/coaching/performance-upload'

      const res = await fetch(endpoint, { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) {
        setStatus({ type: 'error', message: data.error ?? 'Upload failed' })
        return
      }

      const { weekRowsInserted, newlyFlagged, autoAdvanced } = data
      setStatus({
        type: 'success',
        message: `Imported ${weekRowsInserted} employees. ${newlyFlagged} newly added to coaching, ${autoAdvanced} auto-advanced to next stage.`,
      })

      // Refresh coaching data
      qc.invalidateQueries({ queryKey: ['coaching'] })
    } catch {
      setStatus({ type: 'error', message: 'Network error — please try again.' })
    }
  }

  const handleFile = (file: File | undefined) => {
    if (!file) return
    if (!file.name.endsWith('.csv')) {
      setStatus({ type: 'error', message: 'Please upload a .csv file.' })
      return
    }
    upload(file)
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-background p-6 shadow-xl">
          <div className="flex items-start justify-between mb-5">
            <div>
              <Dialog.Title className="text-lg font-semibold">Import Data</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                Upload a CSV file to populate the coaching board.
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {/* Upload type selector */}
          <div className="space-y-2 mb-5">
            {UPLOAD_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => { setSelectedType(t.id); reset() }}
                className={cn(
                  'w-full flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-colors',
                  selectedType === t.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/40'
                )}
              >
                <FileText className={cn('h-5 w-5 mt-0.5 flex-shrink-0', selectedType === t.id ? 'text-primary' : 'text-muted-foreground')} />
                <div>
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Drop zone */}
          {status.type === 'idle' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                handleFile(e.dataTransfer.files[0])
              }}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors',
                dragging ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/40'
              )}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Drop CSV here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Accepts .csv files only</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
          )}

          {/* Loading */}
          {status.type === 'loading' && (
            <div className="rounded-xl border border-muted p-8 text-center">
              <Loader2 className="h-7 w-7 mx-auto animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Processing CSV…</p>
            </div>
          )}

          {/* Success */}
          {status.type === 'success' && (
            <div className="rounded-xl border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20 p-5 space-y-3">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm font-medium">Import complete</p>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300">{status.message}</p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={reset}
                  className="px-3 py-1.5 text-sm rounded-md border border-green-300 hover:bg-green-100 dark:border-green-700 dark:hover:bg-green-900/30 transition-colors text-green-700 dark:text-green-300"
                >
                  Upload another
                </button>
                <button
                  onClick={() => handleClose(false)}
                  className="px-3 py-1.5 text-sm rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {status.type === 'error' && (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 p-5 space-y-3">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm font-medium">Import failed</p>
              </div>
              <p className="text-sm text-red-700 dark:text-red-300">{status.message}</p>
              <button
                onClick={reset}
                className="px-3 py-1.5 text-sm rounded-md border border-red-300 hover:bg-red-100 dark:border-red-700 dark:hover:bg-red-900/30 transition-colors text-red-700 dark:text-red-300"
              >
                Try again
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
