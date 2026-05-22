import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'

export const metadata: Metadata = { title: 'Coaching' }

export default function CoachingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Coaching"
        description="Trainer assignments, coaching sessions, and performance improvement tracking"
      />
      <div className="rounded-xl border-2 border-dashed border-muted p-12 text-center text-muted-foreground">
        Coaching tool — coming next
      </div>
    </div>
  )
}
