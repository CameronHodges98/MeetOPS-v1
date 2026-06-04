import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'

export const metadata: Metadata = { title: 'UPH Tracker' }

export default function UphTrackerPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="UPH Tracker"
        description="Points Per Hour by employee — compare actuals against UPH standards"
      />
      <div className="rounded-xl border-2 border-dashed border-muted p-12 text-center text-muted-foreground">
        UPH Tracker — coming next
      </div>
    </div>
  )
}
