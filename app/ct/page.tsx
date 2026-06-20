import type { Metadata } from 'next'
import { CTWorkspace } from '@/features/coaching/components/ct/CTWorkspace'

export const metadata: Metadata = { title: 'Coaching' }

export default function CTPage() {
  return <CTWorkspace />
}
