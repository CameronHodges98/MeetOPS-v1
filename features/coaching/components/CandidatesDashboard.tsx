'use client'

import { useState, useMemo } from 'react'
import { Upload, ChevronDown, ChevronRight, UserCheck, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useCoachingCandidates, useCoachingUploads, useUploadCoachingCsv, useToggleExempt } from '../queries'
import { useCoachingStore } from '../store'
import { AssignModal } from './AssignModal'
import type { CoachingCandidate } from '@/lib/db/schema'
import { format } from 'date-fns'

function StatusPill({ candidate }: { candidate: CoachingCandidate }) {
  if (candidate.isExempt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        Exempt
      </span>
    )
  }
  if (candidate.assignmentId) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 px-2 py-0.5 text-xs font-medium">
        <CheckCircle2 className="h-3 w-3" />
        Assigned
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-xs font-medium">
      <AlertCircle className="h-3 w-3" />
      Needs Assignment
    </span>
  )
}

interface ManagerGroupProps {
  managerName: string
  candidates: CoachingCandidate[]
  onAssign: (c: CoachingCandidate) => void
}

function ManagerGroup({ managerName, candidates, onAssign }: ManagerGroupProps) {
  const [expanded, setExpanded] = useState(true)
  const toggleExempt = useToggleExempt()

  const unassigned = candidates.filter((c) => !c.isExempt && !c.assignmentId).length
  const assigned = candidates.filter((c) => !c.isExempt && c.assignmentId).length
  const exempt = candidates.filter((c) => c.isExempt).length

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-semibold text-sm">{managerName}</span>
          <span className="text-xs text-muted-foreground">{candidates.length} candidate{candidates.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          {unassigned > 0 && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-xs font-medium">
              {unassigned} to assign
            </span>
          )}
          {assigned > 0 && (
            <span className="rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 px-2 py-0.5 text-xs">
              {assigned} assigned
            </span>
          )}
          {exempt > 0 && (
            <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs">
              {exempt} exempt
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Employee</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Role</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Avg PPH</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Gap %</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Days</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground">Exempt</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {candidates.map((c) => (
                <tr key={c.id} className={cn('hover:bg-muted/20 transition-colors', c.isExempt && 'opacity-60')}>
                  <td className="px-4 py-2.5 font-medium">{c.employeeName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.jobTitle ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                    {Number(c.avgPph ?? 0).toFixed(0)}
                  </td>
                  <td className={cn(
                    'px-4 py-2.5 text-right tabular-nums font-medium',
                    Number(c.avgGapPct ?? 0) > 10 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                  )}>
                    {Number(c.avgGapPct ?? 0).toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{c.daysInSample}</td>
                  <td className="px-4 py-2.5 text-center">
                    <StatusPill candidate={c} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={c.isExempt}
                      onChange={(e) => toggleExempt.mutate({ id: c.id, isExempt: e.target.checked })}
                      className="h-4 w-4 rounded border-border cursor-pointer"
                      title="Mark as exempt (exclude from coaching workflow)"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {!c.isExempt && !c.assignmentId && (
                      <button
                        onClick={() => onAssign(c)}
                        className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Assign
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function CandidatesDashboard() {
  const { activeUploadId, setActiveUploadId, managerFilter, setManagerFilter } = useCoachingStore()
  const [assignCandidate, setAssignCandidate] = useState<CoachingCandidate | null>(null)
  const [uploadError, setUploadError] = useState('')

  const { data: uploads = [] } = useCoachingUploads()
  const uploadCsv = useUploadCoachingCsv()

  // Use active upload or latest
  const resolvedUploadId = activeUploadId ?? (uploads.length > 0 ? uploads[uploads.length - 1]?.id : null)
  const { data: candidates = [], isLoading } = useCoachingCandidates(
    resolvedUploadId !== undefined ? resolvedUploadId : null
  )

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    try {
      const result = await uploadCsv.mutateAsync(file)
      setActiveUploadId(result.uploadId)
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    }
    e.target.value = ''
  }

  // Group by manager
  const grouped = useMemo(() => {
    const map = new Map<string, CoachingCandidate[]>()
    for (const c of candidates) {
      if (managerFilter && c.managerName !== managerFilter) continue
      if (!map.has(c.managerName)) map.set(c.managerName, [])
      map.get(c.managerName)!.push(c)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [candidates, managerFilter])

  const uniqueManagers = useMemo(
    () => [...new Set(candidates.map((c) => c.managerName))].sort(),
    [candidates]
  )

  const currentUpload = uploads.find((u) => u.id === resolvedUploadId)

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Upload selector */}
        {uploads.length > 0 && (
          <select
            value={resolvedUploadId ?? ''}
            onChange={(e) => setActiveUploadId(e.target.value ? Number(e.target.value) : null)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {uploads.map((u) => (
              <option key={u.id} value={u.id}>
                {u.weekStartDate} – {u.weekEndDate} ({u.candidateCount} candidates)
              </option>
            ))}
          </select>
        )}

        {/* Manager filter */}
        {uniqueManagers.length > 1 && (
          <select
            value={managerFilter ?? ''}
            onChange={(e) => setManagerFilter(e.target.value || null)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All Managers</option>
            {uniqueManagers.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}

        <div className="ml-auto">
          <label className={cn(
            'flex items-center gap-2 cursor-pointer rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors',
            uploadCsv.isPending && 'opacity-60 cursor-not-allowed pointer-events-none'
          )}>
            {uploadCsv.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploadCsv.isPending ? 'Uploading…' : 'Upload Weekly CSV'}
            <input
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={handleFileChange}
              disabled={uploadCsv.isPending}
            />
          </label>
        </div>
      </div>

      {uploadError && (
        <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>
      )}

      {/* Summary row */}
      {currentUpload && (
        <div className="flex gap-4 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Week</span>
          <span className="font-medium">{currentUpload.weekStartDate} – {currentUpload.weekEndDate}</span>
          <span className="text-muted-foreground ml-4">Total candidates</span>
          <span className="font-medium">{currentUpload.candidateCount}</span>
          <span className="text-muted-foreground ml-4">Needs assignment</span>
          <span className="font-medium text-amber-600 dark:text-amber-400">
            {candidates.filter((c) => !c.isExempt && !c.assignmentId).length}
          </span>
          <span className="text-muted-foreground ml-4">Assigned</span>
          <span className="font-medium text-blue-600 dark:text-blue-400">
            {candidates.filter((c) => !c.isExempt && c.assignmentId).length}
          </span>
        </div>
      )}

      {/* No upload yet */}
      {!isLoading && uploads.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-muted p-12 text-center text-muted-foreground">
          <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No coaching data uploaded yet</p>
          <p className="text-sm">Upload the weekly performance CSV to see under-performing employees</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {/* Manager groups */}
      {!isLoading && grouped.length > 0 && (
        <div className="space-y-3">
          {grouped.map(([manager, mgCandidates]) => (
            <ManagerGroup
              key={manager}
              managerName={manager}
              candidates={mgCandidates}
              onAssign={setAssignCandidate}
            />
          ))}
        </div>
      )}

      {!isLoading && uploads.length > 0 && candidates.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-muted p-8 text-center text-muted-foreground">
          No candidates meet the coaching threshold in this upload.
        </div>
      )}

      {/* Assignment modal */}
      <AssignModal
        candidate={assignCandidate}
        onClose={() => setAssignCandidate(null)}
      />
    </div>
  )
}
