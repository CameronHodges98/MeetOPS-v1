'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  CoachingUpload,
  CoachingCandidate,
  CoachingTemplate,
  CoachingAssignment,
  UserProfile,
} from '@/lib/db/schema'

export interface CandidatesResponse {
  candidates: CoachingCandidate[]
  upload: CoachingUpload | null
}

export interface AssignmentRow {
  assignment: CoachingAssignment
  candidate: CoachingCandidate
  template: CoachingTemplate
  trainer?: UserProfile | null
}

// ─── Upload history ────────────────────────────────────────────────────────────

export function useCoachingUploads() {
  return useQuery<CoachingUpload[]>({
    queryKey: ['coaching', 'uploads'],
    queryFn: async () => {
      const res = await fetch('/api/coaching/upload')
      if (!res.ok) throw new Error('Failed to fetch uploads')
      return res.json()
    },
  })
}

// ─── Candidates ────────────────────────────────────────────────────────────────

export function useCoachingCandidates(uploadId: number | null, supervisor: string) {
  return useQuery<CandidatesResponse>({
    queryKey: ['coaching', 'candidates', uploadId, supervisor],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (uploadId) params.set('uploadId', String(uploadId))
      if (supervisor) params.set('supervisor', supervisor)
      const res = await fetch(`/api/coaching/candidates?${params}`)
      if (!res.ok) throw new Error('Failed to fetch candidates')
      return res.json()
    },
    enabled: uploadId !== undefined,
  })
}

export function useExemptCandidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isExempt }: { id: number; isExempt: boolean }) => {
      const res = await fetch('/api/coaching/candidates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isExempt }),
      })
      if (!res.ok) throw new Error('Failed to update candidate')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaching', 'candidates'] })
    },
  })
}

// ─── Templates ─────────────────────────────────────────────────────────────────

export function useCoachingTemplates() {
  return useQuery<CoachingTemplate[]>({
    queryKey: ['coaching', 'templates'],
    queryFn: async () => {
      const res = await fetch('/api/coaching/templates')
      if (!res.ok) throw new Error('Failed to fetch templates')
      return res.json()
    },
  })
}

// ─── Trainers (CTs) ────────────────────────────────────────────────────────────

export function useTrainers() {
  return useQuery<UserProfile[]>({
    queryKey: ['coaching', 'trainers'],
    queryFn: async () => {
      const res = await fetch('/api/coaching/trainers')
      if (!res.ok) throw new Error('Failed to fetch trainers')
      return res.json()
    },
  })
}

// ─── Assignments ───────────────────────────────────────────────────────────────

export function useAssignments(uploadId?: number | null) {
  return useQuery<AssignmentRow[]>({
    queryKey: ['coaching', 'assignments', uploadId ?? null],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (uploadId) params.set('uploadId', String(uploadId))
      const res = await fetch(`/api/coaching/assignments?${params}`)
      if (!res.ok) throw new Error('Failed to fetch assignments')
      return res.json()
    },
  })
}

export function useCreateAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      candidateId: number
      trainerClerkId: string
      managerNotes?: string
    }) => {
      const res = await fetch('/api/coaching/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to create assignment')
      return res.json() as Promise<CoachingAssignment>
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaching', 'assignments'] })
      qc.invalidateQueries({ queryKey: ['coaching', 'candidates'] })
    },
  })
}

export function useUpdateAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      id: number
      action: 'start' | 'submit' | 'complete' | 'reassign'
      objectiveResults?: { objectiveId: string; result: string; comment?: string }[]
      ctSummaryNotes?: string
      trainerClerkId?: string
      managerNotes?: string
    }) => {
      const { id, ...rest } = body
      const res = await fetch(`/api/coaching/assignments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      })
      if (!res.ok) throw new Error('Failed to update assignment')
      return res.json() as Promise<CoachingAssignment>
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaching', 'assignments'] })
    },
  })
}
