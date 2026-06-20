'use client'

import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Plus, Trash2, Save, FilePlus2, ListChecks, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  useChecklists, useCreateChecklist, useUpdateChecklist, useDeleteChecklist,
} from '../queries'
import type { ChecklistItem } from '../queries'
import type { ChecklistTemplate } from '@/lib/db/schema'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
}

type Draft = { name: string; items: ChecklistItem[] }

const EMPTY_DRAFT: Draft = { name: '', items: [] }

function newItem(): ChecklistItem {
  return { id: crypto.randomUUID().slice(0, 8), category: 'General', text: '' }
}

export function ChecklistManagerModal({ open, onOpenChange }: Props) {
  const { data: templates } = useChecklists()
  const create = useCreateChecklist()
  const update = useUpdateChecklist()
  const remove = useDeleteChecklist()

  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)

  // Drag-to-reorder checklist items
  const dragIndex = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const moveItem = (from: number, to: number) =>
    setDraft((d) => {
      if (from === to || from < 0 || to < 0 || from >= d.items.length || to >= d.items.length) return d
      const items = [...d.items]
      const [moved] = items.splice(from, 1)
      items.splice(to, 0, moved)
      return { ...d, items }
    })

  const active = (templates ?? []).filter((t) => t.isActive)

  useEffect(() => {
    if (!open) { setEditingId(null); setDraft(EMPTY_DRAFT) }
  }, [open])

  const startNew = () => {
    setEditingId('new')
    setDraft({ name: '', items: [newItem()] })
  }
  const startEdit = (t: ChecklistTemplate) => {
    setEditingId(t.id)
    setDraft({
      name: t.name,
      items: Array.isArray(t.items) ? (t.items as ChecklistItem[]) : [],
    })
  }

  const setItem = (idx: number, patch: Partial<ChecklistItem>) =>
    setDraft((d) => ({ ...d, items: d.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }))
  const addItem = () => setDraft((d) => ({ ...d, items: [...d.items, newItem()] }))
  const removeItem = (idx: number) => setDraft((d) => ({ ...d, items: d.items.filter((_, i) => i !== idx) }))

  const canSave = draft.name.trim() && draft.items.length > 0 && draft.items.every((i) => i.text.trim())
  const isSaving = create.isPending || update.isPending

  const handleSave = async () => {
    const payload = {
      name: draft.name.trim(),
      items: draft.items.map((i) => ({ ...i, category: i.category.trim() || 'General', text: i.text.trim() })),
    }
    if (editingId === 'new') await create.mutateAsync(payload)
    else if (typeof editingId === 'number') await update.mutateAsync({ id: editingId, body: payload })
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-3xl h-[80vh] bg-background border rounded-xl shadow-xl flex flex-col">
          <div className="flex items-center justify-between p-5 border-b">
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              <Dialog.Title className="text-lg font-semibold">Observation Checklists</Dialog.Title>
            </div>
            <Dialog.Close className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></Dialog.Close>
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-[260px_1fr]">
            {/* Template list */}
            <div className="border-r overflow-y-auto p-3 space-y-2">
              <button
                onClick={startNew}
                className="w-full flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
              >
                <FilePlus2 className="h-4 w-4" /> New checklist
              </button>
              {active.map((t) => (
                <button
                  key={t.id}
                  onClick={() => startEdit(t)}
                  className={cn(
                    'w-full text-left rounded-md border px-3 py-2 transition-colors',
                    editingId === t.id ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                  )}
                >
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {Array.isArray(t.items) ? (t.items as unknown[]).length : 0} items
                  </p>
                </button>
              ))}
              {active.length === 0 && (
                <p className="text-xs text-muted-foreground px-1 py-2">No checklists yet.</p>
              )}
            </div>

            {/* Editor */}
            <div className="overflow-y-auto p-5">
              {editingId === null ? (
                <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground">
                  Select a checklist to edit, or create a new one.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Name</label>
                    <input
                      value={draft.name}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="e.g. Floor Coaching Observation"
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground">Checklist items</label>
                      <button onClick={addItem} className="flex items-center gap-1 text-xs text-primary hover:underline">
                        <Plus className="h-3.5 w-3.5" /> Add item
                      </button>
                    </div>
                    {draft.items.map((item, idx) => (
                      <div
                        key={item.id}
                        onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx) }}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (dragIndex.current !== null) moveItem(dragIndex.current, idx)
                          dragIndex.current = null
                          setDragOverIndex(null)
                        }}
                        className={cn(
                          'flex gap-2 items-start rounded-md transition-colors',
                          dragOverIndex === idx && 'ring-2 ring-primary ring-offset-1'
                        )}
                      >
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => { dragIndex.current = idx; e.dataTransfer.effectAllowed = 'move' }}
                          onDragEnd={() => { dragIndex.current = null; setDragOverIndex(null) }}
                          title="Drag to reorder"
                          className="flex-shrink-0 mt-1.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                        <input
                          value={item.category}
                          onChange={(e) => setItem(idx, { category: e.target.value })}
                          placeholder="Category"
                          className="w-28 flex-shrink-0 rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <input
                          value={item.text}
                          onChange={(e) => setItem(idx, { text: e.target.value })}
                          placeholder="What should the trainer observe?"
                          className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          onClick={() => removeItem(idx)}
                          className="flex-shrink-0 p-1.5 text-muted-foreground hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {draft.items.length === 0 && (
                      <p className="text-xs text-muted-foreground">Add at least one item.</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    {typeof editingId === 'number' ? (
                      <button
                        onClick={async () => { await remove.mutateAsync(editingId); setEditingId(null); setDraft(EMPTY_DRAFT) }}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Deactivate checklist
                      </button>
                    ) : <span />}
                    <button
                      onClick={handleSave}
                      disabled={!canSave || isSaving}
                      className="flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
                    >
                      <Save className="h-4 w-4" />
                      {isSaving ? 'Saving…' : 'Save checklist'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
