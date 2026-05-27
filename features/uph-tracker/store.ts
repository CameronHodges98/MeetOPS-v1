import { create } from 'zustand'

interface UphTrackerState {
  dateFrom: string
  dateTo: string
  setDateFrom: (d: string) => void
  setDateTo: (d: string) => void
}

export const useUphTrackerStore = create<UphTrackerState>((set) => ({
  dateFrom: new Date().toISOString().split('T')[0],
  dateTo: new Date().toISOString().split('T')[0],
  setDateFrom: (dateFrom) => set({ dateFrom }),
  setDateTo: (dateTo) => set({ dateTo }),
}))
