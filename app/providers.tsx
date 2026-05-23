'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useWarehouseStore } from '@/lib/stores/warehouse'

interface UserPrefResponse {
  warehouse: { id: number; name: string } | null
}

function WarehouseInitializer() {
  const { activeWarehouse, setActiveWarehouse } = useWarehouseStore()

  useEffect(() => {
    if (activeWarehouse) return

    async function init() {
      // First, try the user's saved preference
      const prefRes = await fetch('/api/user-preferences')
      if (prefRes.ok) {
        const pref: UserPrefResponse = await prefRes.json()
        if (pref?.warehouse) {
          setActiveWarehouse(pref.warehouse)
          return
        }
      }

      // Fall back to the first active warehouse (auto-seeds Mesa)
      const wRes = await fetch('/api/warehouses')
      if (wRes.ok) {
        const list: { id: number; name: string }[] = await wRes.json()
        if (list.length > 0) setActiveWarehouse(list[0])
      }
    }

    init().catch(() => {})
  }, [activeWarehouse, setActiveWarehouse])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <WarehouseInitializer />
      {children}
    </QueryClientProvider>
  )
}
