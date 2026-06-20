import type { EscalationStage, CardStatus } from '@/lib/db/schema'

export type BoardStage = Exclude<EscalationStage, 'roster'>

export const STAGE_ORDER: BoardStage[] = ['c1', 'c2', 'k1', 'k2', 'final']

export const STAGE_CONFIG: Record<BoardStage, {
  label: string
  desc: string
  headerBg: string
  columnBg: string
  border: string
  badge: string
}> = {
  c1: {
    label: '1st Coaching',
    desc: 'Verbal · on the floor',
    headerBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    columnBg: 'bg-emerald-50/40 dark:bg-emerald-950/10',
    border: 'border-emerald-300 dark:border-emerald-700',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
  },
  c2: {
    label: '2nd Coaching',
    desc: 'Documented · 2nd occurrence',
    headerBg: 'bg-lime-100 dark:bg-lime-900/40',
    columnBg: 'bg-lime-50/40 dark:bg-lime-950/10',
    border: 'border-lime-300 dark:border-lime-700',
    badge: 'bg-lime-100 text-lime-800 dark:bg-lime-900/50 dark:text-lime-200',
  },
  k1: {
    label: '1st Corrective',
    desc: 'Written corrective action',
    headerBg: 'bg-amber-100 dark:bg-amber-900/40',
    columnBg: 'bg-amber-50/40 dark:bg-amber-950/10',
    border: 'border-amber-300 dark:border-amber-700',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  },
  k2: {
    label: '2nd Corrective',
    desc: 'Final written warning',
    headerBg: 'bg-orange-100 dark:bg-orange-900/40',
    columnBg: 'bg-orange-50/40 dark:bg-orange-950/10',
    border: 'border-orange-300 dark:border-orange-700',
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200',
  },
  final: {
    label: 'Final',
    desc: 'HR / termination review',
    headerBg: 'bg-red-100 dark:bg-red-900/40',
    columnBg: 'bg-red-50/40 dark:bg-red-950/10',
    border: 'border-red-300 dark:border-red-700',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
  },
}

export const CARD_STATUS_STYLE: Record<CardStatus, { card: string; dot: string; label: string }> = {
  in_progress: {
    card: 'border-yellow-400 dark:border-yellow-600',
    dot: 'bg-yellow-400',
    label: 'In Progress',
  },
  completed: {
    card: 'border-green-400 dark:border-green-600',
    dot: 'bg-green-400',
    label: 'Completed',
  },
  exempt: {
    card: 'border-red-300 dark:border-red-600',
    dot: 'bg-red-400',
    label: 'Exempt',
  },
}
