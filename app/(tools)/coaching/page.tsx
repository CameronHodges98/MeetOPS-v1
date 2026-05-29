import type { Metadata } from 'next'
import { currentUser } from '@clerk/nextjs/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { CoachingView } from '@/features/coaching/components/CoachingView'
import { CtView } from '@/features/coaching/components/CtView'

export const metadata: Metadata = { title: 'Coaching' }

export default async function CoachingPage() {
  const user = await currentUser()
  const displayName = user?.fullName ?? user?.firstName ?? ''
  const role = (user?.publicMetadata as Record<string, unknown>)?.role as string | undefined
  const isCt = role === 'ct'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coaching"
        description={
          isCt
            ? 'Your assigned employees — complete the coaching template and submit to your manager'
            : 'Weekly performance candidates by supervisor — employees below 100 PPH in production roles'
        }
      />
      {isCt ? (
        <CtView ctName={displayName} />
      ) : (
        <CoachingView userDisplayName={displayName} />
      )}
    </div>
  )
}
