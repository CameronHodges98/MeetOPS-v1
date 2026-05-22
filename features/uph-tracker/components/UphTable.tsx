'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { STATUS_DISPLAY, formatPPH, formatPoints, formatEmployeeName, JOB_TITLE_ABBREV } from '@/lib/utils/formatters'
import type { UphRow } from '../utils'

type SortKey = 'employeeName' | 'jobTitle' | 'pph' | 'totalPoints' | 'daysWorked' | 'efficiencyPct'
type SortDir = 'asc' | 'desc'

interface UphTableProps {
  rows: UphRow[]
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-muted-foreground/40">↕</span>
  return <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>
}

export function UphTable({ rows }: UphTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('pph')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-muted p-12 text-center text-sm text-muted-foreground">
        No employee data found for the selected date range.
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-8 px-4 py-3 text-left font-medium text-muted-foreground">#</th>
              <Th label="Employee" sortKey="employeeName" current={sortKey} dir={sortDir} onSort={handleSort} />
              <Th label="Role" sortKey="jobTitle" current={sortKey} dir={sortDir} onSort={handleSort} />
              <Th label="Days" sortKey="daysWorked" current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
              <Th label="Points" sortKey="totalPoints" current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
              <Th label="PPH" sortKey="pph" current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
              <Th label="Efficiency" sortKey="efficiencyPct" current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((row, idx) => {
              const sd = STATUS_DISPLAY[row.status]
              return (
                <tr
                  key={row.employeeId}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium">{formatEmployeeName(row.employeeName)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span title={row.jobTitle}>{JOB_TITLE_ABBREV[row.jobTitle] ?? row.jobTitle}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.daysWorked}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPoints(row.totalPoints)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatPPH(row.pph)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <EfficiencyBar pct={row.efficiencyPct} status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    {row.status !== 'insufficient_data' ? (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          sd.bgClass,
                          sd.colorClass
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', sd.dotClass)} />
                        {sd.label}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({
  label,
  sortKey,
  current,
  dir,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
  align?: 'left' | 'right'
}) {
  const active = current === sortKey
  return (
    <th
      className={cn(
        'px-4 py-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors',
        align === 'right' ? 'text-right' : 'text-left'
      )}
      onClick={() => onSort(sortKey)}
    >
      {label}
      <SortIcon active={active} dir={dir} />
    </th>
  )
}

function EfficiencyBar({ pct, status }: { pct: number; status: UphRow['status'] }) {
  const barPct = Math.min(pct, 130) // cap visual bar at 130%
  const colorClass =
    status === 'on_target'
      ? 'bg-green-500'
      : status === 'watch'
        ? 'bg-amber-500'
        : status === 'needs_attention'
          ? 'bg-red-500'
          : 'bg-gray-300'

  return (
    <div className="flex items-center justify-end gap-2">
      <span className="w-10 text-right tabular-nums">{pct}%</span>
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', colorClass)}
          style={{ width: `${(barPct / 130) * 100}%` }}
        />
      </div>
    </div>
  )
}
