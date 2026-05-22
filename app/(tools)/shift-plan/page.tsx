import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'

export const metadata: Metadata = { title: 'Shift Plan' }

export default function ShiftPlanPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Shift Plan"
        description="Real-time headcount tracking and labor flex decisions"
      />
      <div className="rounded-xl border-2 border-dashed border-muted p-12 text-center text-muted-foreground">
        Shift Plan tool — coming next
      </div>
    </div>
  )
}
