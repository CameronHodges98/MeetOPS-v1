import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { CoachingView } from '@/features/coaching/components/CoachingView'

export const metadata: Metadata = { title: 'Coaching' }

export default function CoachingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Coaching"
        description="Assign CTs to under-performers, track session progress, and manage templates"
      />
      <CoachingView />
    </div>
  )
}
