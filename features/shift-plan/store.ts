import { create } from 'zustand'

interface ShiftPlanState {
  selectedDate: string
  selectedDepartment: string | null
  setSelectedDate: (date: string) => void
  setSelectedDepartment: (dept: string | null) => void
}

export const useShiftPlanStore = create<ShiftPlanState>((set) => ({
  selectedDate: new Date().toISOString().split('T')[0],
  selectedDepartment: null,
  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedDepartment: (dept) => set({ selectedDepartment: dept }),
}))
