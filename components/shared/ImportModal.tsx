'use client'

import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Upload, X, ChevronDown, Users, BarChart2, ClipboardList, Activity, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import Papa from 'papaparse'
import { cn } from '@/lib/utils/cn'
import type { UphScaleRow } from '@/app/api/ingest/uph-scale/route'
import type { ActionTotalRow } from '@/app/api/ingest/action-totals/route'
import type { IngestEmployeeRow, IngestActionRow } from '@/app/api/ingest/action-logs/route'

type FileType = 'roster' | 'uph_scale' | 'action_logs' | 'action_totals'

const BATCH_SIZE = 500

const FILE_OPTIONS: {
  type: FileType
  label: string
  icon: React.ElementType
  description: string
  fileName: string
  notes: string
  ready: boolean
}[] = [
  {
    type: 'roster',
    label: 'Employee Roster',
    icon: Users,
    description: 'Paylocity employee export. Must be uploaded before action logs.',
    fileName: 'Roster.csv',
    notes: 'Export from the Paylocity reporting dashboard using the standard Group hierarchy report.',
    ready: false,
  },
  {
    type: 'uph_scale',
    label: 'UPH Standards Scale',
    icon: BarChart2,
    description: 'Benchmark points-per-action table. Replaces all existing standards on import.',
    fileName: 'UPH_Scale.csv',
    notes: 'Columns: ID, ACTION, LOCATION, ITEM SIZE, PROGRAM PROFILE, PROGRAM TYPE, SEC / ACTION, POINTS / ACTION, ACTIONS / HOUR, ACTIVE AT, INACTIVE AT.',
    ready: true,
  },
  {
    type: 'action_totals',
    label: 'Action Totals (Weekly)',
    icon: Activity,
    description: 'Hourly action count export used for historical shift predictions.',
    fileName: '5_11 - 5_17 actions.csv',
    notes: 'Columns: date (M/D/YY), hour, employee, action, Record Count. Multiple weeks can be uploaded — data is aggregated per department.',
    ready: true,
  },
  {
    type: 'action_logs',
    label: 'Action Logs (Raw)',
    icon: ClipboardList,
    description: 'Daily warehouse action log export. Required for cycle time analysis.',
    fileName: 'Action_Log_Example.csv',
    notes: 'Requires: Date, Hour, Created At, Paylocity Id, Job Title, Employee, Location, Log Type, Action, Program Type, Size.',
    ready: true,
  },
]

type UploadState = 'idle' | 'parsing' | 'uploading' | 'done' | 'error'

interface UploadStatus {
  state: UploadState
  message: string
  inserted: number
  skipped: number
  totalRows: number
  batchesDone: number
  totalBatches: number
}

const IDLE_STATUS: UploadStatus = {
  state: 'idle', message: '', inserted: 0, skipped: 0,
  totalRows: 0, batchesDone: 0, totalBatches: 0,
}

interface ImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Parse M/D/YY date format from the actions CSV into YYYY-MM-DD
function parseActionDate(raw: string): string {
  const parts = raw.trim().split('/')
  if (parts.length !== 3) return raw
  const [m, d, yy] = parts.map(Number)
  const year = yy < 100 ? 2000 + yy : yy
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function ImportModal({ open, onOpenChange }: ImportModalProps) {
  const [selected, setSelected] = useState<FileType | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<UploadStatus>(IDLE_STATUS)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelected(null)
      setFile(null)
      setStatus(IDLE_STATUS)
    }
    onOpenChange(next)
  }

  function handleCardClick(type: FileType, isReady: boolean) {
    if (!isReady) return
    const next = selected === type ? null : type
    setSelected(next)
    if (!next) {
      setFile(null)
      setStatus(IDLE_STATUS)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setStatus(IDLE_STATUS)
  }

  async function handleUpload() {
    if (!file || !selected) return
    if (selected === 'uph_scale') return handleUphScaleUpload()
    if (selected === 'action_totals') return handleActionTotalsUpload()
    if (selected === 'action_logs') return handleActionLogsUpload()
  }

  // ── UPH Scale upload ──────────────────────────────────────────

  async function handleUphScaleUpload() {
    if (!file) return
    setStatus({ ...IDLE_STATUS, state: 'parsing', message: 'Parsing CSV…' })

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^﻿/, '').trim(),
      complete: async (result) => {
        const raw = result.data
        if (!raw.length) {
          setStatus({ ...IDLE_STATUS, state: 'error', message: 'File is empty or could not be parsed.' })
          return
        }

        const rows: UphScaleRow[] = raw.map((r) => ({
          action: r['ACTION']?.trim() ?? '',
          location: r['LOCATION']?.trim() ?? '',
          itemSize: r['ITEM SIZE']?.trim() ?? '',
          programProfile: r['PROGRAM PROFILE']?.trim() ?? '',
          secPerAction: r['SEC / ACTION']?.trim() ?? '',
          pointsPerAction: r['POINTS / ACTION']?.trim() ?? '',
          uph: r['ACTIONS / HOUR']?.trim() ?? '',
        })).filter((r) => r.action && r.uph)

        setStatus({
          state: 'uploading',
          message: `Uploading ${rows.length} standards…`,
          inserted: 0, skipped: 0,
          totalRows: rows.length, batchesDone: 0, totalBatches: 1,
        })

        try {
          const res = await fetch('/api/ingest/uph-scale', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows, replace: true }),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            setStatus({ ...IDLE_STATUS, state: 'error', message: (err as { error?: string }).error ?? 'Server error' })
            return
          }
          const { inserted } = await res.json() as { inserted: number }
          setStatus({
            state: 'done', message: 'Import complete',
            inserted, skipped: rows.length - inserted,
            totalRows: rows.length, batchesDone: 1, totalBatches: 1,
          })
        } catch {
          setStatus({ ...IDLE_STATUS, state: 'error', message: 'Network error. Check your connection.' })
        }
      },
      error: (err: { message: string }) => {
        setStatus({ ...IDLE_STATUS, state: 'error', message: err.message })
      },
    })
  }

  // ── Action Totals upload ──────────────────────────────────────

  async function handleActionTotalsUpload() {
    if (!file) return
    setStatus({ ...IDLE_STATUS, state: 'parsing', message: 'Parsing CSV…' })

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^﻿/, '').trim(),
      complete: async (result) => {
        const raw = result.data
        if (!raw.length) {
          setStatus({ ...IDLE_STATUS, state: 'error', message: 'File is empty or could not be parsed.' })
          return
        }

        // Aggregate client-side: sum Record Count by (date, hour, action)
        const aggMap = new Map<string, ActionTotalRow>()
        for (const r of raw) {
          const dateRaw = r['date']?.trim() ?? ''
          const hour = parseInt(r['hour']?.trim() ?? '0', 10)
          const action = r['action']?.trim() ?? ''
          const count = parseInt(r['Record Count']?.trim() ?? '0', 10)
          if (!dateRaw || !action || isNaN(count) || count <= 0) continue

          const date = parseActionDate(dateRaw)
          const key = `${date}|${hour}|${action}`
          const existing = aggMap.get(key)
          if (existing) {
            existing.totalCount += count
          } else {
            aggMap.set(key, { date, hour, action, totalCount: count })
          }
        }

        const aggregated = Array.from(aggMap.values())
        const totalBatches = Math.ceil(aggregated.length / BATCH_SIZE)

        setStatus({
          state: 'uploading',
          message: `Uploading ${aggregated.length} aggregated rows…`,
          inserted: 0, skipped: 0,
          totalRows: aggregated.length, batchesDone: 0, totalBatches,
        })

        let totalInserted = 0
        let totalSkipped = 0

        for (let i = 0; i < totalBatches; i++) {
          const batch = aggregated.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
          try {
            const res = await fetch('/api/ingest/action-totals', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rows: batch }),
            })
            if (!res.ok) {
              const err = await res.json().catch(() => ({}))
              setStatus((prev) => ({
                ...prev,
                state: 'error',
                message: (err as { error?: string }).error ?? `Server error on batch ${i + 1}`,
              }))
              return
            }
            const { inserted, skipped } = await res.json() as { inserted: number; skipped: number }
            totalInserted += inserted
            totalSkipped += skipped
            setStatus({
              state: 'uploading',
              message: `Uploading batch ${i + 1} of ${totalBatches}…`,
              inserted: totalInserted, skipped: totalSkipped,
              totalRows: aggregated.length, batchesDone: i + 1, totalBatches,
            })
          } catch {
            setStatus((prev) => ({
              ...prev,
              state: 'error',
              message: `Network error on batch ${i + 1}. Check your connection.`,
            }))
            return
          }
        }

        setStatus({
          state: 'done', message: 'Import complete',
          inserted: totalInserted, skipped: totalSkipped,
          totalRows: aggregated.length, batchesDone: totalBatches, totalBatches,
        })
      },
      error: (err: { message: string }) => {
        setStatus({ ...IDLE_STATUS, state: 'error', message: err.message })
      },
    })
  }

  // ── Action Logs (raw) upload ──────────────────────────────────

  async function handleActionLogsUpload() {
    if (!file) return
    setStatus({ ...IDLE_STATUS, state: 'parsing', message: 'Parsing CSV…' })

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^﻿/, '').trim(),
      complete: async (result) => {
        const raw = result.data
        if (!raw.length) {
          setStatus({ ...IDLE_STATUS, state: 'error', message: 'File is empty or could not be parsed.' })
          return
        }

        const empMap = new Map<string, IngestEmployeeRow>()
        for (const r of raw) {
          const pid = r['Paylocity Id']?.trim()
          if (pid && !empMap.has(pid)) {
            empMap.set(pid, {
              paylocityId: pid,
              cargoId: r['Cargo Id'] ? Number(r['Cargo Id']) : null,
              name: r['Employee']?.trim() ?? '',
              jobTitle: r['Job Title']?.trim() ?? '',
              status: r['Status']?.trim() ?? 'Active',
              location: r['Location']?.trim() || 'Mesa',
            })
          }
        }

        const actionRows: IngestActionRow[] = raw.map((r) => ({
          paylocityId: r['Paylocity Id']?.trim() ?? '',
          createdAt: r['Created At']?.trim() ?? '',
          date: r['Date']?.trim() ?? '',
          hour: r['Hour']?.trim() ?? '',
          location: r['Location']?.trim() || 'Mesa',
          logType: r['Log Type']?.trim().toLowerCase() ?? '',
          itemId: r['Item Id']?.trim() ?? '',
          action: r['Action']?.trim() ?? '',
          program: r['Program']?.trim() ?? '',
          programType: r['Program Type']?.trim() ?? '',
          size: r['Size']?.trim().toLowerCase() ?? '',
        }))

        const totalBatches = Math.ceil(actionRows.length / BATCH_SIZE)
        setStatus({
          state: 'uploading',
          message: `Upserting ${empMap.size} employees…`,
          inserted: 0, skipped: 0,
          totalRows: actionRows.length, batchesDone: 0, totalBatches,
        })

        let totalInserted = 0
        let totalSkipped = 0

        for (let i = 0; i < totalBatches; i++) {
          const batch = actionRows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
          const isFirst = i === 0
          try {
            const res = await fetch('/api/ingest/action-logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                employees: isFirst ? Array.from(empMap.values()) : undefined,
                rows: batch,
                isFirst,
              }),
            })
            if (!res.ok) {
              const err = await res.json().catch(() => ({}))
              setStatus((prev) => ({
                ...prev,
                state: 'error',
                message: (err as { error?: string }).error ?? `Server error on batch ${i + 1}`,
              }))
              return
            }
            const { inserted, skipped } = await res.json() as { inserted: number; skipped: number }
            totalInserted += inserted
            totalSkipped += skipped
            setStatus({
              state: 'uploading',
              message: `Uploading batch ${i + 1} of ${totalBatches}…`,
              inserted: totalInserted, skipped: totalSkipped,
              totalRows: actionRows.length, batchesDone: i + 1, totalBatches,
            })
          } catch {
            setStatus((prev) => ({
              ...prev,
              state: 'error',
              message: `Network error on batch ${i + 1}. Check your connection.`,
            }))
            return
          }
        }

        setStatus({
          state: 'done', message: 'Import complete',
          inserted: totalInserted, skipped: totalSkipped,
          totalRows: actionRows.length, batchesDone: totalBatches, totalBatches,
        })
      },
      error: (err: { message: string }) => {
        setStatus({ ...IDLE_STATUS, state: 'error', message: err.message })
      },
    })
  }

  const progressPct =
    status.totalBatches > 0
      ? Math.round((status.batchesDone / status.totalBatches) * 100)
      : 0

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
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

          {/* File type cards */}
          <div className="space-y-3">
            {FILE_OPTIONS.map(({ type, label, icon: Icon, description, fileName, notes, ready }) => {
              const isSelected = selected === type
              return (
                <div
                  key={type}
                  onClick={() => handleCardClick(type, ready)}
                  className={cn(
                    'w-full rounded-xl border-2 p-4 text-left transition-all',
                    ready ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                      : ready
                        ? 'border-border hover:border-blue-300 hover:bg-muted/40 dark:hover:bg-muted/20'
                        : 'border-border bg-muted/20'
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
                    <div className="flex items-center gap-2 shrink-0">
                      {!ready && (
                        <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">
                          Coming soon
                        </span>
                      )}
                      {ready && (
                        <ChevronDown className={cn(
                          'h-4 w-4 text-muted-foreground transition-transform',
                          isSelected && 'rotate-180 text-blue-500'
                        )} />
                      )}
                    </div>
                  </div>

                  {/* Expanded upload zone */}
                  {isSelected && (
                    <div
                      className="mt-4 space-y-3 border-t border-blue-200 dark:border-blue-800 pt-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-sm text-foreground">{description}</p>
                      <p className="text-xs text-muted-foreground">{notes}</p>

                      {/* File picker — hidden during upload/done */}
                      {(status.state === 'idle' || status.state === 'error') && (
                        <div
                          className="flex items-center justify-center rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-700 bg-background p-6 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <div className="text-center">
                            <Upload className="mx-auto h-6 w-6 text-blue-400 mb-2" />
                            {file ? (
                              <>
                                <p className="text-sm font-medium text-foreground">{file.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {(file.size / 1024 / 1024).toFixed(1)} MB · Click to change
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-sm font-medium text-foreground">Click to select a CSV file</p>
                                <p className="text-xs text-muted-foreground mt-0.5">or drag and drop</p>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleFileChange}
                      />

                      {/* Error banner */}
                      {status.state === 'error' && (
                        <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3">
                          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          <p className="text-sm text-red-700 dark:text-red-400">{status.message}</p>
                        </div>
                      )}

                      {/* Progress */}
                      {(status.state === 'parsing' || status.state === 'uploading') && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
                            <p className="text-sm text-foreground">{status.message}</p>
                          </div>
                          {status.state === 'uploading' && (
                            <>
                              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {status.inserted.toLocaleString()} rows inserted
                                {status.skipped > 0 && ` · ${status.skipped.toLocaleString()} skipped`}
                              </p>
                            </>
                          )}
                        </div>
                      )}

                      {/* Done */}
                      {status.state === 'done' && (
                        <div className="flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 p-3">
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-green-800 dark:text-green-300">Import complete</p>
                            <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                              {status.inserted.toLocaleString()} rows inserted
                              {status.skipped > 0 && ` · ${status.skipped.toLocaleString()} skipped`}
                              {' '}· {status.totalRows.toLocaleString()} total
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      {(status.state === 'idle' || status.state === 'error') && (
                        <button
                          onClick={handleUpload}
                          disabled={!file}
                          className={cn(
                            'w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors',
                            file
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-muted text-muted-foreground cursor-not-allowed'
                          )}
                        >
                          Upload
                        </button>
                      )}

                      {status.state === 'done' && (
                        <button
                          onClick={() => { setFile(null); setStatus(IDLE_STATUS) }}
                          className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                        >
                          Upload another file
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
