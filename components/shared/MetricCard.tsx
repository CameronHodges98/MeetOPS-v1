import { cn } from '@/lib/utils/cn'
import type { PerformanceStatus } from '@/lib/utils/uphCalculator'
import { STATUS_DISPLAY } from '@/lib/utils/formatters'

interface MetricCardProps {
  label: string
  value: string | number
  subValue?: string
  status?: PerformanceStatus
  trend?: 'up' | 'down' | 'flat'
  className?: string
}

export function MetricCard({
  label,
  value,
  subValue,
  status,
  trend,
  className,
}: MetricCardProps) {
  const statusDisplay = status ? STATUS_DISPLAY[status] : null

  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-5 shadow-sm',
        status === 'needs_attention' && 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30',
        status === 'watch' && 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30',
        status === 'on_target' && 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {statusDisplay && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              statusDisplay.bgClass,
              statusDisplay.colorClass
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', statusDisplay.dotClass)} />
            {statusDisplay.label}
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
      {subValue && (
        <p className="mt-1 text-xs text-muted-foreground">{subValue}</p>
      )}
    </div>
  )
}
