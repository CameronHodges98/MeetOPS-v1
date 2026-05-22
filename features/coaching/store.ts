import { create } from 'zustand'

interface CoachingState {
  statusFilter: string | null
  selectedSessionId: number | null
  setStatusFilter: (s: string | null) => void
  setSelectedSessionId: (id: number | null) => void
}

export const useCoachingStore = create<CoachingState>((set) => ({
  statusFilter: null,
  selectedSessionId: null,
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setSelectedSessionId: (selectedSessionId) => set({ selectedSessionId }),
}))
