'use client'

import { Clock, CheckCircle2, ClipboardCheck, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { STAGE_CONFIG, type BoardStage } from '../../constants'
import type { CTSession } from '../../queries'

export const CT_STATUS_META: Record<string, { label: string; badge: string; Icon: typeof Clock }> = {
  assigned:    { label: 'Ready to start',        badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',   Icon: Clock },
  in_coaching: { label: 'In progress',           badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200', Icon: ClipboardCheck },
  review:      { label: 'Awaiting manager',      badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',     Icon: CheckCircle2 },
  complete:    { label: 'Completed',             badge: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',  Icon: CheckCircle2 },
  unassigned:  { label: 'Unassigned',            badge: 'bg-muted text-muted-foreground', Icon: Clock },
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

export function CTSessionCard({ session, onClick }: { session: CTSession; onClick: () => void }) {
  const meta = CT_STATUS_META[session.status] ?? CT_STATUS_META.unassigned
  const stageCfg = session.escalationStage !== 'roster'
    ? STAGE_CONFIG[session.escalationStage as BoardStage]
    : null
  const { Icon } = meta

  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-background border rounded-xl p-4 transition-all hover:shadow-md hover:border-primary/50"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 h-10 w-10 rounded-full border-2 border-border bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
          {initials(session.employeeName)}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate leading-tight">{session.employeeName}</p>
          <p className="text-xs text-muted-foreground truncate">{session.jobTitle} · {session.managerName}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {stageCfg && (
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', stageCfg.badge)}>
                {stageCfg.label}
              </span>
            )}
            <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full', meta.badge)}>
              <Icon className="h-3 w-3" />
              {meta.label}
            </span>
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}
