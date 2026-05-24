'use client'

import { DateRangePicker } from '@/components/shared/DateRangePicker'
import { useUphTrackerStore } from '../store'

const JOB_TITLES = [
  'Picker',
  'Inventory Processor',
  'Load Out',
  'Put Away',
  'Lot Attendant',
  'Returns Clerk',
  'Material Handler',
  'Area Manager',
  'Safety Coordinator',
] as const

export function UphFilters() {
  const { dateFrom, dateTo, selectedJobTitle, setDateFrom, setDateTo, setSelectedJobTitle } =
    useUphTrackerStore()

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Date Range</label>
        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onRangeChange={(from, to) => { setDateFrom(from); setDateTo(to) }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Job Title</label>
        <select
          value={selectedJobTitle ?? ''}
          onChange={(e) => setSelectedJobTitle(e.target.value || null)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All Roles</option>
          {JOB_TITLES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
