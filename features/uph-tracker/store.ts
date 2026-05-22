import { create } from 'zustand'

interface UphTrackerState {
  dateFrom: string
  dateTo: string
  selectedJobTitle: string | null
  setDateFrom: (d: string) => void
  setDateTo: (d: string) => void
  setSelectedJobTitle: (t: string | null) => void
}

export const useUphTrackerStore = create<UphTrackerState>((set) => ({
  dateFrom: new Date().toISOString().split('T')[0],
  dateTo: new Date().toISOString().split('T')[0],
  selectedJobTitle: null,
  setDateFrom: (dateFrom) => set({ dateFrom }),
  setDateTo: (dateTo) => set({ dateTo }),
  setSelectedJobTitle: (selectedJobTitle) => set({ selectedJobTitle }),
}))
