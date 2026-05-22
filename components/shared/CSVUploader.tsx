'use client'

import { useState, useRef } from 'react'
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { CsvFileType } from '@/lib/ingestion/csv'
import type { IngestionResult } from '@/lib/ingestion/types'

const FILE_TYPE_LABELS: Record<CsvFileType, string> = {
  action_logs: 'Action Logs (Cycle Time CSV)',
  uph_standards: 'UPH Standards Scale',
  appointments: 'Appointments Per Hour',
  throughput: 'Processing Throughput',
  employees: 'Employee Roster',
}

interface CSVUploaderProps {
  fileType: CsvFileType
  onSuccess?: (result: IngestionResult) => void
  className?: string
}

export function CSVUploader({ fileType, onSuccess, className }: CSVUploaderProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<IngestionResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      setState('error')
      setResult(null)
      return
    }

    setState('loading')
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('fileType', fileType)

    try {
      const res = await fetch('/api/ingest/csv', { method: 'POST', body: formData })
      const data: IngestionResult = await res.json()
      setResult(data)
      setState(data.success ? 'success' : 'error')
      if (data.success && onSuccess) onSuccess(data)
    } catch (err) {
      setState('error')
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-sm font-medium text-muted-foreground">
        {FILE_TYPE_LABELS[fileType]}
      </p>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50 hover:bg-muted/50',
          state === 'success' && 'border-green-400 bg-green-50',
          state === 'error' && 'border-red-400 bg-red-50',
        )}
      >
        {state === 'loading' && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
        {state === 'success' && <CheckCircle className="h-8 w-8 text-green-600" />}
        {state === 'error' && <AlertCircle className="h-8 w-8 text-red-600" />}
        {state === 'idle' && <Upload className="h-8 w-8 text-muted-foreground" />}

        <p className="mt-2 text-sm font-medium">
          {state === 'idle' && 'Drop CSV here or click to browse'}
          {state === 'loading' && 'Importing...'}
          {state === 'success' && 'Import successful'}
          {state === 'error' && 'Import failed'}
        </p>
        <p className="text-xs text-muted-foreground">.csv files only</p>
      </div>

      {/* Result summary */}
      {result && (
        <div className={cn(
          'rounded-lg p-3 text-sm',
          result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        )}>
          <p className="font-medium">
            {result.recordsInserted} inserted · {result.recordsSkipped} skipped · {result.recordsFailed} failed
            <span className="ml-2 font-normal opacity-70">({result.durationMs}ms)</span>
          </p>
          {result.errors.slice(0, 3).map((e, i) => (
            <p key={i} className="mt-1 text-xs opacity-80">
              {e.row ? `Row ${e.row}: ` : ''}{e.message}
            </p>
          ))}
          {result.errors.length > 3 && (
            <p className="mt-1 text-xs opacity-80">+{result.errors.length - 3} more errors</p>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </div>
  )
}
