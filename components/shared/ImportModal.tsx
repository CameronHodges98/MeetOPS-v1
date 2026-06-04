'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

interface ImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportModal({ open, onOpenChange }: ImportModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
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

          <div className="rounded-xl border-2 border-dashed border-muted p-10 text-center text-muted-foreground text-sm">
            Import options coming soon
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
