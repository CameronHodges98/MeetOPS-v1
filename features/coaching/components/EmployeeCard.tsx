'use client'

import * as Tooltip from '@radix-ui/react-tooltip'
import { AlertTriangle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { CARD_STATUS_STYLE } from '../constants'
import type { RosterEntryWithDetails } from '../queries'

interface Props {
  entry: RosterEntryWithDetails
  compact?: boolean
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
  onClick?: () => void
}

function MetricPill({ label, value, flagged, tooltip }: { label: string; value: string; flagged?: boolean; tooltip: string }) {
  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className={cn(
            'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium cursor-default',
            flagged
              ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
              : 'bg-muted text-muted-foreground'
          )}>
            {label} {value}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 rounded-md bg-popover text-popover-foreground border px-3 py-1.5 text-xs shadow-md max-w-[200px]"
            sideOffset={4}
          >
            {tooltip}
            <Tooltip.Arrow className="fill-popover" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

export function EmployeeCard({ entry, compact, draggable, onDragStart, onDragEnd, onClick }: Props) {
  const statusStyle = CARD_STATUS_STYLE[entry.cardStatus]
  const hasPending = !!entry.pendingApproval

  const initials = entry.employeeName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        'group relative bg-background border-2 rounded-lg p-2.5 cursor-pointer select-none transition-all',
        'hover:shadow-md hover:-translate-y-0.5',
        statusStyle.card,
        draggable && 'active:cursor-grabbing',
        hasPending && 'opacity-70'
      )}
    >
      {/* Pending indicator */}
      {hasPending && (
        <div className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white">
          <Clock className="h-2.5 w-2.5" />
        </div>
      )}

      <div className="flex items-start gap-2">
        {/* Avatar */}
        <div className="flex-shrink-0 h-7 w-7 rounded-full border-2 border-border bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-sm font-semibold truncate leading-tight">{entry.employeeName}</p>
            {/* Status dot */}
            <Tooltip.Provider delayDuration={300}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <span className={cn('flex-shrink-0 h-2 w-2 rounded-full', statusStyle.dot)} />
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content className="z-50 rounded-md bg-popover text-popover-foreground border px-3 py-1.5 text-xs shadow-md" sideOffset={4}>
                    Status: {statusStyle.label}
                    <Tooltip.Arrow className="fill-popover" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          </div>

          {!compact && (
            <p className="text-[11px] text-muted-foreground truncate leading-tight">{entry.jobTitle} · {entry.managerName}</p>
          )}
        </div>
      </div>

      {/* Quick insight metrics */}
      {!compact && (entry.triggerPph !== null || entry.triggerGapPct !== null) && (
        <div className="mt-2 flex flex-wrap gap-1 items-center">
          {entry.triggerPph !== null && (
            <MetricPill
              label="PPH"
              value={String(Math.round(entry.triggerPph))}
              flagged={entry.triggerPph < 100}
              tooltip={`Points Per Hour when flagged. Below 100 triggers coaching eligibility.`}
            />
          )}
          {entry.triggerGapPct !== null && (
            <MetricPill
              label="Gap"
              value={`${Math.round(entry.triggerGapPct)}%`}
              flagged={entry.triggerGapPct > 10}
              tooltip={`Gap% when flagged. Above 10% triggers coaching eligibility.`}
            />
          )}
          {entry.triggerDirectPct !== null && (
            <MetricPill
              label="Dir"
              value={`${Math.round(entry.triggerDirectPct)}%`}
              flagged={false}
              tooltip={`Direct function % when flagged. Must be ≥40% to qualify for coaching.`}
            />
          )}

          {/* Weeks flagged badge */}
          {entry.consecutiveWeeksFlagged > 0 && (
            <Tooltip.Provider delayDuration={300}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 text-[10px] font-medium cursor-default">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {entry.consecutiveWeeksFlagged}w
                  </span>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content className="z-50 rounded-md bg-popover text-popover-foreground border px-3 py-1.5 text-xs shadow-md max-w-[180px]" sideOffset={4}>
                    Flagged for {entry.consecutiveWeeksFlagged} consecutive week{entry.consecutiveWeeksFlagged !== 1 ? 's' : ''}. Employee has been below threshold this many weeks in a row.
                    <Tooltip.Arrow className="fill-popover" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          )}
        </div>
      )}
    </div>
  )
}
