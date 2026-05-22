'use client'

import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { useUphData } from '@/features/uph-tracker/queries'
import { useUphTrackerStore } from '@/features/uph-tracker/store'
import { computeUphRow } from '@/features/uph-tracker/utils'
import { UphFilters } from '@/features/uph-tracker/components/UphFilters'
import { UphSummaryCards } from '@/features/uph-tracker/components/UphSummaryCards'
import { UphTable } from '@/features/uph-tracker/components/UphTable'

// Note: metadata export doesn't work in 'use client' pages — set via layout if needed.
// Kept here as documentation only.
// export const metadata: Metadata = { title: 'UPH Tracker' }

export default function UphTrackerPage() {
  const { dateFrom, dateTo, selectedJobTitle } = useUphTrackerStore()
  const { data: rawRows = [], isLoading, isError } = useUphData(dateFrom, dateTo, selectedJobTitle)

  const rows = rawRows.map(computeUphRow)

  return (
    <div className="space-y-6">
      <PageHeader
        title="UPH Tracker"
        description="Points Per Hour by employee — compare actuals against UPH standards."
        actions={<UphFilters />}
      />

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load UPH data. Check your database connection.
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : (
        <UphSummaryCards rows={rows} />
      )}

      {isLoading ? (
        <div className="h-64 rounded-xl border bg-muted/30 animate-pulse" />
      ) : (
        <UphTable rows={rows} />
      )}

      <p className="text-xs text-muted-foreground">
        PPH = total points ÷ estimated hours (days worked × {10}h shift).
        Efficiency = standard-pace hours ÷ actual hours — 100% means on-standard speed.
      </p>
    </div>
  )
}
