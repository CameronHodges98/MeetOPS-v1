import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'

export const metadata: Metadata = { title: 'Cycle Time' }

export default function CycleTimePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cycle Time"
        description="Per-employee action bottleneck detection and analysis"
      />
      <div className="rounded-xl border-2 border-dashed border-muted p-12 text-center text-muted-foreground">
        Cycle Time tracker — coming next
      </div>
    </div>
  )
}
