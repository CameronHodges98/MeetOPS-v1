import { create } from 'zustand'
import type { ShiftQuarter } from '@/config/constants'

interface ShiftPlanState {
  selectedDate: string
  selectedQuarter: ShiftQuarter | null   // null = no drawer open
  setSelectedDate: (date: string) => void
  setSelectedQuarter: (quarter: ShiftQuarter | null) => void
}

export const useShiftPlanStore = create<ShiftPlanState>((set) => ({
  selectedDate: new Date().toISOString().split('T')[0],
  selectedQuarter: null,
  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedQuarter: (quarter) => set({ selectedQuarter: quarter }),
}))
