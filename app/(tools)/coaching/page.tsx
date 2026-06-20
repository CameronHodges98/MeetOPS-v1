import type { Metadata } from 'next'
import { CoachingBoard } from '@/features/coaching/components/CoachingBoard'

export const metadata: Metadata = { title: 'Coaching' }

export default function CoachingPage() {
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 3.5rem - 3rem)' }}>
      <div className="flex-shrink-0 mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Coaching & Corrective Action</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track employee coaching progressions — drag cards between stages or click to open details.
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <CoachingBoard />
      </div>
    </div>
  )
}
