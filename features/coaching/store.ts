'use client'

import { create } from 'zustand'

interface CoachingState {
  placeholder: null
}

export const useCoachingStore = create<CoachingState>(() => ({
  placeholder: null,
}))
