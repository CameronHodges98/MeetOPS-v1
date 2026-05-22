import { create } from 'zustand'
import { CYCLE_TIME_THRESHOLDS } from '@/config/constants'

interface CycleTimeState {
  dateFrom: string
  dateTo: string
  minRatio: number
  selectedEmployeeId: number | null
  setDateFrom: (d: string) => void
  setDateTo: (d: string) => void
  setMinRatio: (r: number) => void
  setSelectedEmployeeId: (id: number | null) => void
}

export const useCycleTimeStore = create<CycleTimeState>((set) => ({
  dateFrom: new Date().toISOString().split('T')[0],
  dateTo: new Date().toISOString().split('T')[0],
  minRatio: CYCLE_TIME_THRESHOLDS.FLAG_RATIO,
  selectedEmployeeId: null,
  setDateFrom: (dateFrom) => set({ dateFrom }),
  setDateTo: (dateTo) => set({ dateTo }),
  setMinRatio: (minRatio) => set({ minRatio }),
  setSelectedEmployeeId: (selectedEmployeeId) => set({ selectedEmployeeId }),
}))
