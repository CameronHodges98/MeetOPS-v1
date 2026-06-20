import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CoachingRosterEntry, CoachingSession, CoachingApproval, ChecklistTemplate, EscalationStage, CardStatus } from '@/lib/db/schema'

// ── Checklist item / form data shapes ─────────────────────────────
export type ChecklistItem = { id: string; category: string; text: string }
export type ChecklistResult = { id: string; result: 'pass' | 'fail'; comment?: string }

// A coaching session enriched with its roster card's live stage/status,
// as returned by /api/coaching/ct/sessions for the CT workspace.
export type CTSession = CoachingSession & {
  currentStage: EscalationStage
  cardStatus: CardStatus
  consecutiveWeeksFlagged: number
}

export type RosterEntryWithDetails = CoachingRosterEntry & {
  sessions: CoachingSession[]
  approvals: CoachingApproval[]
  pendingApproval: CoachingApproval | null
}

export type WeekEmployee = {
  employeeName: string
  managerName: string
  jobTitle: string
  pph: number | null
  gapPct: number | null
  directPct: number | null
}

export type RosterResponse = {
  entries: RosterEntryWithDetails[]
  weekEmployees: WeekEmployee[]
  pendingApprovalsCount: number
}

export type PendingApproval = {
  approval: CoachingApproval
  entry: CoachingRosterEntry
}

export type CT = {
  id: number
  clerkId: string
  name: string | null
  email: string
  areaManagerClerkId: string | null
}

export function useCoachingRoster() {
  return useQuery<RosterResponse>({
    queryKey: ['coaching', 'roster'],
    queryFn: () => fetch('/api/coaching/roster').then((r) => r.json()),
    refetchInterval: 30_000,
  })
}

export function useCoachingApprovals() {
  return useQuery<PendingApproval[]>({
    queryKey: ['coaching', 'approvals'],
    queryFn: () => fetch('/api/coaching/approvals').then((r) => r.json()),
    refetchInterval: 15_000,
  })
}

export function useCTs() {
  return useQuery<CT[]>({
    queryKey: ['coaching', 'cts'],
    queryFn: () => fetch('/api/coaching/cts').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })
}

// ── CT workspace ──────────────────────────────────────────────────

export function useMySessions() {
  return useQuery<{ sessions: CTSession[] }>({
    queryKey: ['coaching', 'my-sessions'],
    queryFn: () => fetch('/api/coaching/ct/sessions').then((r) => r.json()),
    refetchInterval: 30_000,
  })
}

export function useChecklists() {
  return useQuery<ChecklistTemplate[]>({
    queryKey: ['coaching', 'checklists'],
    queryFn: () => fetch('/api/coaching/checklists').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateChecklist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; items: ChecklistItem[] }) =>
      fetch('/api/coaching/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coaching', 'checklists'] }),
  })
}

export function useUpdateChecklist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: {
      id: number
      body: { name?: string; items?: ChecklistItem[]; isActive?: boolean }
    }) =>
      fetch(`/api/coaching/checklists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coaching', 'checklists'] }),
  })
}

export function useDeleteChecklist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/coaching/checklists/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coaching', 'checklists'] }),
  })
}

export function useRosterMove() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: {
      id: number
      body: { action: 'request_move' | 'direct_move'; toStage: EscalationStage; reason?: string }
    }) =>
      fetch(`/api/coaching/roster/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaching'] })
    },
  })
}

export function useSetCardStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, cardStatus, reason }: { id: number; cardStatus: CardStatus; reason?: string }) =>
      fetch(`/api/coaching/roster/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_status', cardStatus, reason }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coaching'] }),
  })
}

export function useReviewApproval() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision, reviewNotes }: {
      id: number
      decision: 'approved' | 'denied'
      reviewNotes?: string
    }) =>
      fetch(`/api/coaching/approvals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reviewNotes }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coaching'] }),
  })
}

export function useUpdateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: {
      id: number
      body: {
        status?: string
        assignedCtClerkId?: string
        formData?: unknown
        checklistTemplateId?: number
        ctNotes?: string
        managerNotes?: string
      }
    }) =>
      fetch(`/api/coaching/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coaching'] }),
  })
}
