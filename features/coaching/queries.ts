'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CoachingCandidate, CoachingAssignment, CoachingTemplate, CoachingUpload } from '@/lib/db/schema'

// ---- Uploads ----

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

export function useUploadCoachingCsv() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/coaching/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<{ uploadId: number; candidateCount: number; weekStart: string; weekEnd: string }>
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaching', 'uploads'] })
      qc.invalidateQueries({ queryKey: ['coaching', 'candidates'] })
    },
  })
}

// ---- Candidates ----

export function useCoachingCandidates(uploadId: number | null | undefined) {
  return useQuery<CoachingCandidate[]>({
    queryKey: ['coaching', 'candidates', uploadId],
    queryFn: async () => {
      const url = uploadId
        ? `/api/coaching/candidates?uploadId=${uploadId}`
        : '/api/coaching/candidates'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch candidates')
      return res.json()
    },
    enabled: uploadId !== undefined,
  })
}

export function useToggleExempt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isExempt }: { id: number; isExempt: boolean }) => {
      const res = await fetch('/api/coaching/candidates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isExempt }),
      })
      if (!res.ok) throw new Error('Failed to update')
      return res.json() as Promise<CoachingCandidate>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coaching', 'candidates'] }),
  })
}

// ---- Templates ----

export function useCoachingTemplates(department?: string | null) {
  return useQuery<CoachingTemplate[]>({
    queryKey: ['coaching', 'templates', department],
    queryFn: async () => {
      const url = department
        ? `/api/coaching/templates?department=${encodeURIComponent(department)}`
        : '/api/coaching/templates'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch templates')
      return res.json()
    },
  })
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { department: string; name: string; objectives: { id: string; text: string }[] }) => {
      const res = await fetch('/api/coaching/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to create template')
      return res.json() as Promise<CoachingTemplate>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coaching', 'templates'] }),
  })
}

export function useUpdateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { id: number; name?: string; department?: string; objectives?: unknown[]; isActive?: boolean }) => {
      const res = await fetch('/api/coaching/templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to update template')
      return res.json() as Promise<CoachingTemplate>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coaching', 'templates'] }),
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/coaching/templates?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete template')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coaching', 'templates'] }),
  })
}

// ---- Trainers ----

export interface TrainerWithCapacity {
  clerkId: string
  displayName: string | null
  email: string | null
  trainerSchedule: string | null
  activeCount: number
  availableSlots: number
}

export function useTrainers(schedule?: 'weekday' | 'weekend' | null) {
  return useQuery<TrainerWithCapacity[]>({
    queryKey: ['coaching', 'trainers', schedule],
    queryFn: async () => {
      const url = schedule
        ? `/api/coaching/trainers?schedule=${schedule}`
        : '/api/coaching/trainers'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch trainers')
      return res.json()
    },
  })
}

// ---- Assignments ----

export interface AssignmentWithDetails extends CoachingAssignment {
  employeeName: string
  managerName: string
  jobTitle: string | null
  avgPph: string | null
  avgGapPct: string | null
  templateName: string
  templateDepartment: string
  templateObjectives: unknown
  trainerName: string | null
}

export function useCoachingAssignments(params?: {
  status?: string | null
  trainerClerkId?: string | null
}) {
  return useQuery<AssignmentWithDetails[]>({
    queryKey: ['coaching', 'assignments', params],
    queryFn: async () => {
      const sp = new URLSearchParams()
      if (params?.status) sp.set('status', params.status)
      if (params?.trainerClerkId) sp.set('trainerClerkId', params.trainerClerkId)
      const res = await fetch(`/api/coaching/assignments?${sp}`)
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
      templateId: number
      trainerClerkId: string
      managerNotes?: string
    }) => {
      const res = await fetch('/api/coaching/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }))
        throw new Error(err.error ?? 'Failed to create assignment')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaching', 'assignments'] })
      qc.invalidateQueries({ queryKey: ['coaching', 'candidates'] })
      qc.invalidateQueries({ queryKey: ['coaching', 'trainers'] })
    },
  })
}

export function useUpdateAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      id: number
      status?: 'assigned' | 'in_progress' | 'pending_review' | 'complete'
      objectiveResults?: unknown
      ctSummaryNotes?: string
      trainerClerkId?: string
      managerNotes?: string
    }) => {
      const res = await fetch('/api/coaching/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to update assignment')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaching', 'assignments'] })
      qc.invalidateQueries({ queryKey: ['coaching', 'trainers'] })
    },
  })
}
