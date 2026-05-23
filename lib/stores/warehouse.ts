import { create } from 'zustand'

interface Warehouse {
  id: number
  name: string
}

interface WarehouseState {
  activeWarehouse: Warehouse | null
  setActiveWarehouse: (w: Warehouse) => void
}

export const useWarehouseStore = create<WarehouseState>((set) => ({
  activeWarehouse: null,
  setActiveWarehouse: (w) => set({ activeWarehouse: w }),
}))
