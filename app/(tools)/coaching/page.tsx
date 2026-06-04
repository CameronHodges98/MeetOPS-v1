import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'

export const metadata: Metadata = { title: 'Coaching' }

export default function CoachingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Coaching"
        description="Performance coaching workflows — candidates, assignments, and follow-through"
      />
      <div className="rounded-xl border-2 border-dashed border-muted p-12 text-center text-muted-foreground">
        Coaching — coming soon
      </div>
    </div>
  )
}
