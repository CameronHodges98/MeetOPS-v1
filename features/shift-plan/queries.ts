import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { FlexPlanEntry, ShiftPlan, ShiftPlanSubmission } from '@/lib/db/schema'
import type { ExemptEntry } from '@/app/api/shift-plan/submissions/route'
import type { DeptSnapshot, ShiftEntry } from './utils'
import { useWarehouseStore } from '@/lib/stores/warehouse'

export interface ShiftPlanResponse {
  plan: ShiftPlan
  departments: DeptSnapshot[]
}

export interface HistoricalRow {
  department: string
  quarter: number
  avg_headcount_needed: number
  avg_total_actions: number
  avg_uph: number
  data_points: number
}

export interface HistoricalHourRow {
  department: string
  hour: number
  avg_headcount_needed: number
  avg_total_actions: number
  avg_uph: number
  data_points: number
}

// ── Plan shell ────────────────────────────────────────────────

export function useShiftPlan(date: string) {
  const location = useWarehouseStore((s) => s.activeWarehouse?.name ?? 'Mesa')
  return useQuery<ShiftPlanResponse>({
    queryKey: ['shift-plan', date, location],
    queryFn: async () => {
      const res = await fetch(`/api/shift-plan?date=${date}&location=${encodeURIComponent(location)}`)
      if (!res.ok) throw new Error('Failed to load shift plan')
      return res.json()
    },
  })
}

// ── Flex entries ──────────────────────────────────────────────

export function useFlexEntries(planId: number | undefined) {
  return useQuery<FlexPlanEntry[]>({
    queryKey: ['flex-entries', planId],
    queryFn: async () => {
      const res = await fetch(`/api/shift-plan/flex?planId=${planId}`)
      if (!res.ok) throw new Error('Failed to load flex entries')
      return res.json()
    },
    enabled: !!planId,
  })
}

export function useAddFlexEntry(planId: number | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      quarter: number
      fromDepartment: string
      toDepartment: string
      headcountMoved: number
      notes?: string
    }) => {
      const res = await fetch('/api/shift-plan/flex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, ...body }),
      })
      if (!res.ok) throw new Error('Failed to add flex entry')
      return res.json() as Promise<FlexPlanEntry>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flex-entries', planId] }),
  })
}

export function useDeleteFlexEntry(planId: number | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/shift-plan/flex/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete flex entry')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flex-entries', planId] }),
  })
}

// ── Submissions ───────────────────────────────────────────────

export function useResetSubmission(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { planId: number; department: string }) => {
      const res = await fetch('/api/shift-plan/submissions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to reset submission')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift-plan', date] }),
  })
}

export function useSubmitDept(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      planId: number
      department: string
      calloutCount: number
      otCount: number
      exemptEntries: ExemptEntry[]
    }) => {
      const res = await fetch('/api/shift-plan/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to save submission')
      return res.json() as Promise<ShiftPlanSubmission>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift-plan', date] }),
  })
}

export function useUpdateDeptRoster(date: string) {
  const location = useWarehouseStore((s) => s.activeWarehouse?.name ?? 'Mesa')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { department: string; count: number; dayType: 'weekday' | 'weekend'; shiftSchedule?: ShiftEntry[] | null }) => {
      const res = await fetch('/api/shift-plan/roster', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, location }),
      })
      if (!res.ok) throw new Error('Failed to update roster')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift-plan', date] }),
  })
}

// ── Historical demand ─────────────────────────────────────────

export function useHistoricalDemand(date: string) {
  const location = useWarehouseStore((s) => s.activeWarehouse?.name ?? 'Mesa')
  return useQuery<HistoricalRow[]>({
    queryKey: ['shift-plan-historical', date, location],
    queryFn: async () => {
      const res = await fetch(`/api/shift-plan/historical?date=${date}&location=${encodeURIComponent(location)}`)
      if (!res.ok) throw new Error('Failed to load historical data')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useHistoricalHourly(date: string) {
  const location = useWarehouseStore((s) => s.activeWarehouse?.name ?? 'Mesa')
  return useQuery<HistoricalHourRow[]>({
    queryKey: ['shift-plan-historical-hourly', date, location],
    queryFn: async () => {
      const res = await fetch(`/api/shift-plan/historical/hourly?date=${date}&location=${encodeURIComponent(location)}`)
      if (!res.ok) throw new Error('Failed to load hourly historical data')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ── Publish / Unpublish ───────────────────────────────────────

export function usePublishPlan(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (planId: number) => {
      const res = await fetch('/api/shift-plan/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      if (!res.ok) throw new Error('Failed to publish plan')
      return res.json() as Promise<ShiftPlan>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift-plan', date] }),
  })
}

export function useUnpublishPlan(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (planId: number) => {
      const res = await fetch('/api/shift-plan/unpublish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      if (!res.ok) throw new Error('Failed to unlock plan')
      return res.json() as Promise<ShiftPlan>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift-plan', date] }),
  })
}
