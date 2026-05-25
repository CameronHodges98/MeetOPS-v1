'use client'

import { create } from 'zustand'

interface CoachingState {
  // Dashboard view
  activeUploadId: number | null
  statusFilter: 'assigned' | 'in_progress' | 'pending_review' | 'complete' | null
  managerFilter: string | null
  // Assignment modal
  assignModalCandidateId: number | null
  // Template editor
  editingTemplateId: number | null
  // Actions
  setActiveUploadId: (id: number | null) => void
  setStatusFilter: (s: CoachingState['statusFilter']) => void
  setManagerFilter: (m: string | null) => void
  setAssignModalCandidateId: (id: number | null) => void
  setEditingTemplateId: (id: number | null) => void
}

export const useCoachingStore = create<CoachingState>((set) => ({
  activeUploadId: null,
  statusFilter: null,
  managerFilter: null,
  assignModalCandidateId: null,
  editingTemplateId: null,
  setActiveUploadId: (activeUploadId) => set({ activeUploadId }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setManagerFilter: (managerFilter) => set({ managerFilter }),
  setAssignModalCandidateId: (assignModalCandidateId) => set({ assignModalCandidateId }),
  setEditingTemplateId: (editingTemplateId) => set({ editingTemplateId }),
}))
