'use client'

import { ArrowRight, Users, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { SHIFT_QUARTERS } from '@/config/constants'
import type { FlexPlanEntry } from '@/lib/db/schema'
import type { DeptSnapshot } from '../utils'
import { computeQuarterEffective } from '../utils'

type Quarter = typeof SHIFT_QUARTERS[number]

interface QuarterCardProps {
  quarter: Quarter
  snapshots: DeptSnapshot[]
  confirmedFlexes: FlexPlanEntry[]
  submittedCount: number
  totalDepts: number
  isPublished: boolean
  onClick: () => void
}

export function QuarterCard({
  quarter,
  snapshots,
  confirmedFlexes,
  submittedCount,
  totalDepts,
  isPublished,
  onClick,
}: QuarterCardProps) {
  const qFlexes = confirmedFlexes.filter((f) => f.quarter === quarter.quarter)

  const deptRows = snapshots.map((snap) => ({
    dept: snap.department,
    effective: computeQuarterEffective(snap, quarter.hours),
  }))

  const totalAssigned = deptRows.reduce((s, r) => s + r.effective, 0)
  const allSubmitted = submittedCount >= totalDepts

  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-bold text-foreground">{quarter.label}</span>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full border font-medium',
            allSubmitted
              ? 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
              : 'bg-muted border-border text-muted-foreground'
          )}>
            {submittedCount}/{totalDepts} submitted
          </span>
          {isPublished && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 font-medium">
              Published
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>

      <div className="space-y-3">
        {/* Headcount */}
        <div className="flex items-start gap-2.5">
          <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">Total assigned</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {deptRows.map((r) => (
                <span key={r.dept} className="text-xs">
                  <span className="font-medium text-foreground">{r.effective}</span>
                  <span className="text-muted-foreground"> {r.dept}</span>
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{totalAssigned} total assigned</p>
          </div>
        </div>

        {/* Confirmed flex moves */}
        {qFlexes.length > 0 && (
          <div className="flex items-start gap-2.5">
            <ArrowRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">Labor flex</p>
              {qFlexes.map((f) => (
                <p key={f.id} className="text-xs font-medium text-foreground">
                  +{f.headcountMoved} {f.fromDepartment} → {f.toDepartment}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </button>
  )
}
