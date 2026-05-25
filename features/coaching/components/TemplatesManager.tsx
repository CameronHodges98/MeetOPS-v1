'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, X, GripVertical, Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  useCoachingTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from '../queries'
import type { CoachingTemplate } from '@/lib/db/schema'

const DEPARTMENTS = ['Processing', 'Returns', 'Picking', 'Put Away', 'Customer Service']

interface Objective {
  id: string
  text: string
}

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

interface TemplateEditorProps {
  template?: CoachingTemplate | null
  onSave: (data: { department: string; name: string; objectives: Objective[] }) => Promise<void>
  onCancel: () => void
}

function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const [department, setDepartment] = useState(template?.department ?? DEPARTMENTS[0])
  const [name, setName] = useState(template?.name ?? '')
  const [objectives, setObjectives] = useState<Objective[]>(
    (template?.objectives as Objective[] | null) ?? [{ id: generateId(), text: '' }]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function addObjective() {
    setObjectives((prev) => [...prev, { id: generateId(), text: '' }])
  }

  function removeObjective(id: string) {
    setObjectives((prev) => prev.filter((o) => o.id !== id))
  }

  function updateObjective(id: string, text: string) {
    setObjectives((prev) => prev.map((o) => (o.id === id ? { ...o, text } : o)))
  }

  async function handleSave() {
    if (!name.trim()) { setError('Template name is required'); return }
    const validObjectives = objectives.filter((o) => o.text.trim())
    if (validObjectives.length === 0) { setError('Add at least one objective'); return }
    setSaving(true)
    try {
      await onSave({ department, name: name.trim(), objectives: validObjectives })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Department</label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Template Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Processing Standard"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Objectives</label>
        <div className="space-y-2">
          {objectives.map((obj, idx) => (
            <div key={obj.id} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{idx + 1}.</span>
              <input
                type="text"
                value={obj.text}
                onChange={(e) => updateObjective(obj.id, e.target.value)}
                placeholder="Describe the objective or skill to evaluate…"
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={() => removeObjective(obj.id)}
                disabled={objectives.length <= 1}
                className="text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addObjective}
          className="mt-2 flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add objective
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : template ? 'Save Changes' : 'Create Template'}
        </button>
      </div>
    </div>
  )
}

interface TemplateCardProps {
  template: CoachingTemplate
  onEdit: () => void
  onDelete: () => void
}

function TemplateCard({ template, onEdit, onDelete }: TemplateCardProps) {
  const objectives = (template.objectives as Objective[] | null) ?? []
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-sm">{template.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{template.department}</p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={onEdit}
            className="flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:border-red-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        {objectives.map((obj, idx) => (
          <div key={obj.id} className="flex items-start gap-2 text-sm">
            <span className="text-xs text-muted-foreground mt-0.5 w-4 shrink-0">{idx + 1}.</span>
            <span className="text-muted-foreground">{obj.text}</span>
          </div>
        ))}
        {objectives.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No objectives defined.</p>
        )}
      </div>
    </div>
  )
}

export function TemplatesManager() {
  const { data: templates = [], isLoading } = useCoachingTemplates()
  const createTemplate = useCreateTemplate()
  const updateTemplate = useUpdateTemplate()
  const deleteTemplate = useDeleteTemplate()

  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  // Group by department
  const grouped = DEPARTMENTS.map((dept) => ({
    dept,
    templates: templates.filter((t) => t.department === dept),
  })).filter((g) => g.templates.length > 0 || creating)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Templates define what objectives a CT evaluates during each coaching session.
        </p>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Template
        </button>
      </div>

      {creating && (
        <TemplateEditor
          onSave={async (data) => {
            await createTemplate.mutateAsync(data)
            setCreating(false)
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : templates.length === 0 && !creating ? (
        <div className="rounded-xl border-2 border-dashed border-muted p-8 text-center text-muted-foreground">
          No templates yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-6">
          {DEPARTMENTS.map((dept) => {
            const deptTemplates = templates.filter((t) => t.department === dept)
            if (deptTemplates.length === 0) return null
            return (
              <div key={dept}>
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{dept}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {deptTemplates.map((t) =>
                    editingId === t.id ? (
                      <TemplateEditor
                        key={t.id}
                        template={t}
                        onSave={async (data) => {
                          await updateTemplate.mutateAsync({ id: t.id, ...data })
                          setEditingId(null)
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        onEdit={() => setEditingId(t.id)}
                        onDelete={() => {
                          if (confirm(`Delete "${t.name}"?`)) deleteTemplate.mutate(t.id)
                        }}
                      />
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
