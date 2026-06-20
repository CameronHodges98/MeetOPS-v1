'use client'

import { useState } from 'react'
import { UserButton, useUser } from '@clerk/nextjs'
import { GraduationCap, ClipboardList, History, Inbox } from 'lucide-react'
import { useMySessions } from '../../queries'
import type { CTSession } from '../../queries'
import { CTSessionCard } from './CTSessionCard'
import { CTObservationPanel } from './CTObservationPanel'

const ACTIVE_STATUSES = ['assigned', 'in_coaching']

export function CTWorkspace() {
  const { user } = useUser()
  const { data, isLoading } = useMySessions()
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const sessions = data?.sessions ?? []
  const active = sessions.filter((s) => ACTIVE_STATUSES.includes(s.status))
  const history = sessions.filter((s) => !ACTIVE_STATUSES.includes(s.status))
  const selected = sessions.find((s) => s.id === selectedId) ?? null

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Isolated header — no manager navbar on this surface */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 h-14 flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <span className="font-bold">MeetOPS · Coaching</span>
          <div className="flex-1" />
          <UserButton />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Your coaching sessions{user?.firstName ? `, ${user.firstName}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Run each observation on the floor, complete the checklist, and submit it back to the manager.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Active queue */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm">Active ({active.length})</h2>
              </div>
              {active.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  <Inbox className="h-7 w-7 mx-auto mb-2 opacity-60" />
                  No sessions assigned to you right now.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {active.map((s) => (
                    <CTSessionCard key={s.id} session={s} onClick={() => setSelectedId(s.id)} />
                  ))}
                </div>
              )}
            </section>

            {/* History */}
            {history.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold text-sm">Recent ({history.length})</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {history.map((s) => (
                    <CTSessionCard key={s.id} session={s} onClick={() => setSelectedId(s.id)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <CTObservationPanel session={selected} onClose={() => setSelectedId(null)} />
    </div>
  )
}
