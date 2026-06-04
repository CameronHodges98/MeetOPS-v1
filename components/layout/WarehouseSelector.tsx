'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Check, Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useWarehouseStore } from '@/lib/stores/warehouse'

interface Warehouse {
  id: number
  name: string
}

export function WarehouseSelector() {
  const { activeWarehouse, setActiveWarehouse } = useWarehouseStore()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/warehouses')
      .then((r) => r.json())
      .then((data: Warehouse[]) => setWarehouses(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function selectWarehouse(w: Warehouse) {
    setActiveWarehouse(w)
    setOpen(false)
    await fetch('/api/user-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warehouseId: w.id }),
    })
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors',
          'bg-background hover:bg-muted text-foreground'
        )}
      >
        <span>{activeWarehouse?.name ?? '—'}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[160px] rounded-lg border border-border bg-background shadow-lg overflow-hidden">
          {warehouses.map((w) => (
            <button
              key={w.id}
              onClick={() => selectWarehouse(w)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <Check className={cn('h-3.5 w-3.5 shrink-0', activeWarehouse?.id === w.id ? 'text-primary' : 'invisible')} />
              {w.name}
            </button>
          ))}
          <div className="border-t border-border">
            <div
              title="Admin access required (coming soon)"
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground opacity-50 cursor-not-allowed select-none"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              Add warehouse
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
