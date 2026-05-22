import { MetricCard } from '@/components/shared/MetricCard'
import type { UphRow } from '../utils'
import { summarizeUphRows } from '../utils'
import { formatPPH } from '@/lib/utils/formatters'

interface UphSummaryCardsProps {
  rows: UphRow[]
}

export function UphSummaryCards({ rows }: UphSummaryCardsProps) {
  const { totalEmployees, avgPph, onTargetCount, needsAttentionCount } = summarizeUphRows(rows)

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard
        label="Active Employees"
        value={totalEmployees}
        subValue="in selected range"
      />
      <MetricCard
        label="Avg PPH"
        value={formatPPH(avgPph)}
        subValue="points per hour"
      />
      <MetricCard
        label="On Target"
        value={onTargetCount}
        subValue={`${totalEmployees > 0 ? Math.round((onTargetCount / totalEmployees) * 100) : 0}% of employees`}
        status={onTargetCount > 0 ? 'on_target' : undefined}
      />
      <MetricCard
        label="Needs Attention"
        value={needsAttentionCount}
        subValue={`${totalEmployees > 0 ? Math.round((needsAttentionCount / totalEmployees) * 100) : 0}% of employees`}
        status={needsAttentionCount > 0 ? 'needs_attention' : undefined}
      />
    </div>
  )
}
