import { create } from 'zustand'
import type { EscalationStage } from '@/lib/db/schema'

interface PendingMove {
  rosterEntryId: number
  fromStage: EscalationStage
  toStage: EscalationStage
}

interface CoachingStore {
  search: string
  managerFilter: string
  selectedEntryId: number | null
  pendingMove: PendingMove | null
  showApprovals: boolean
  setSearch: (v: string) => void
  setManagerFilter: (v: string) => void
  setSelectedEntryId: (id: number | null) => void
  setPendingMove: (move: PendingMove | null) => void
  setShowApprovals: (v: boolean) => void
}

export const useCoachingStore = create<CoachingStore>((set) => ({
  search: '',
  managerFilter: 'all',
  selectedEntryId: null,
  pendingMove: null,
  showApprovals: false,
  setSearch: (v) => set({ search: v }),
  setManagerFilter: (v) => set({ managerFilter: v }),
  setSelectedEntryId: (id) => set({ selectedEntryId: id }),
  setPendingMove: (move) => set({ pendingMove: move }),
  setShowApprovals: (v) => set({ showApprovals: v }),
}))
