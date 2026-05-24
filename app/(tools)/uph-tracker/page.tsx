'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useUphData } from '@/features/uph-tracker/queries'
import { useUphTrackerStore } from '@/features/uph-tracker/store'
import { computeUphRow } from '@/features/uph-tracker/utils'
import { UphFilters } from '@/features/uph-tracker/components/UphFilters'
import { UphSummaryCards } from '@/features/uph-tracker/components/UphSummaryCards'
import { UphTable } from '@/features/uph-tracker/components/UphTable'
import { HelpButton, HelpModal } from '@/components/shared/HelpModal'
import type { HelpSection } from '@/components/shared/HelpModal'

const HELP_SECTIONS: HelpSection[] = [
  {
    title: 'What is PPH?',
    body: 'Points Per Hour (PPH) is the core productivity metric. Every action in the warehouse (scan, pick, putaway, process) earns a set number of points based on the difficulty and time it takes. PPH = total points earned ÷ hours worked. A higher PPH means the associate is working at or above the standard pace.',
  },
  {
    title: 'How PPH is calculated',
    body: [
      'Points come from the UPH Standards table — each action type has a defined points value.',
      'Hours are estimated as days worked × 10-hour shift. Actual shift data improves this when available.',
      'The standard PPH for each employee is their weighted average — based on the specific mix of actions they actually performed.',
      'Gap % = how far below standard they are. 0% = on pace. 20% = meaningfully behind.',
    ],
  },
  {
    title: 'Status badges',
    body: [
      'Green — At or above 95% of their standard. On track.',
      'Amber — Between 80–95% of standard. Monitor and check in.',
      'Red — Below 80% of standard. Needs attention today — coaching trigger.',
    ],
  },
  {
    title: 'How to use this page',
    body: [
      'Filter by date range to see a specific day or week.',
      'Filter by job title to focus on one department.',
      'Use the summary cards at the top to get a quick facility-wide read.',
      'Red rows are your action items — check in with those associates or their supervisor before the shift ends.',
      'Import new data via the Import button in the top nav.',
    ],
  },
  {
    title: 'Important caveats',
    body: [
      'PPH is not the whole picture. An associate doing Variety Pallets all day will have the same PPH target as one doing presorts, but the effort is very different.',
      'Short date ranges (< 3 days) can be noisy — a single bad hour skews the number.',
      'Associates new to a task type will naturally run lower PPH while building speed.',
    ],
  },
]

export default function UphTrackerPage() {
  const { dateFrom, dateTo, selectedJobTitle } = useUphTrackerStore()
  const { data: rawRows = [], isLoading, isError } = useUphData(dateFrom, dateTo, selectedJobTitle)
  const [helpOpen, setHelpOpen] = useState(false)

  const rows = rawRows.map(computeUphRow)

  return (
    <div className="space-y-6">
      <PageHeader
        title="UPH Tracker"
        description="Points Per Hour by employee — compare actuals against UPH standards."
        actions={
          <div className="flex items-center gap-2">
            <HelpButton onClick={() => setHelpOpen(true)} />
            <UphFilters />
          </div>
        }
      />
      <HelpModal
        title="UPH Tracker — Reference"
        subtitle="How to read and use this page"
        sections={HELP_SECTIONS}
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
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
