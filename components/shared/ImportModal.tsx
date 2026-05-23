'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Upload, X, ChevronDown, Users, BarChart2, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type FileType = 'roster' | 'uph_scale' | 'action_logs'

const FILE_OPTIONS: {
  type: FileType
  label: string
  icon: React.ElementType
  description: string
  fileName: string
  notes: string
}[] = [
  {
    type: 'roster',
    label: 'Employee Roster',
    icon: Users,
    description: 'Paylocity employee export. Must be uploaded before action logs.',
    fileName: 'Roster.csv',
    notes: 'Export from the Paylocity reporting dashboard using the standard Group hierarchy report.',
  },
  {
    type: 'uph_scale',
    label: 'UPH Standards Scale',
    icon: BarChart2,
    description: 'Benchmark points-per-action table used to calculate PPH and efficiency.',
    fileName: 'UPH_scale.csv',
    notes: 'Contains ACTION, SEC / ACTION, POINTS / ACTION, and ACTIONS / HOUR columns.',
  },
  {
    type: 'action_logs',
    label: 'Action Logs',
    icon: ClipboardList,
    description: 'Cycle Time CSV from the warehouse system. Requires employees and UPH scale first.',
    fileName: 'Action_Log_Example.csv',
    notes: 'Contains all scan, pick, and process events per employee with timestamps.',
  },
]

interface ImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportModal({ open, onOpenChange }: ImportModalProps) {
  const [selected, setSelected] = useState<FileType | null>(null)

  function handleOpenChange(next: boolean) {
    if (!next) setSelected(null)
    onOpenChange(next)
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-background p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <Dialog.Title className="text-lg font-semibold">Import Data</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                Select the file type you are uploading.
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {/* File type selection */}
          <div className="space-y-3">
            {FILE_OPTIONS.map(({ type, label, icon: Icon, description, fileName, notes }) => {
              const isSelected = selected === type
              return (
                <button
                  key={type}
                  onClick={() => setSelected(isSelected ? null : type)}
                  className={cn(
                    'w-full rounded-xl border-2 p-4 text-left transition-all',
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-border hover:border-blue-200 hover:bg-muted/40'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                        isSelected ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{label}</p>
                        <p className="text-xs text-muted-foreground font-mono">{fileName}</p>
                      </div>
                    </div>
                    <ChevronDown className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform shrink-0',
                      isSelected && 'rotate-180 text-blue-500'
                    )} />
                  </div>

                  {/* Expanded content */}
                  {isSelected && (
                    <div className="mt-4 space-y-2 border-t border-blue-200 pt-4">
                      <p className="text-sm text-foreground">{description}</p>
                      <p className="text-xs text-muted-foreground">{notes}</p>
                      <div className="mt-3 flex items-center justify-center rounded-lg border-2 border-dashed border-blue-300 bg-white p-6 text-sm text-muted-foreground">
                        <div className="text-center">
                          <Upload className="mx-auto h-6 w-6 text-blue-400 mb-1" />
                          <p className="text-sm font-medium text-foreground">Upload coming soon</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Logic will be wired in the next step</p>
                        </div>
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
