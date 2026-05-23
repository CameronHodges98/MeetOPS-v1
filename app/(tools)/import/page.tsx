'use client'

import { PageHeader } from '@/components/layout/PageHeader'
import { CSVUploader } from '@/components/shared/CSVUploader'

const IMPORT_STEPS = [
  {
    step: 1,
    title: 'Employee Roster',
    fileType: 'employees' as const,
    description: 'Must be imported first. All other imports depend on employee Paylocity IDs.',
    required: true,
    columns: 'Paylocity Id, Employee Name, Job Title, Location, Status',
  },
  {
    step: 2,
    title: 'UPH Standards Scale',
    fileType: 'uph_standards' as const,
    description: 'The UPH_Scale.csv benchmark table. Must be imported before action logs.',
    required: true,
    columns: 'ACTION, LOCATION, ITEM SIZE, PROGRAM PROFILE, SEC / ACTION, POINTS / ACTION, UPH (Actions/HR)',
  },
  {
    step: 3,
    title: 'Action Logs',
    fileType: 'action_logs' as const,
    description: 'The main event data exported from the warehouse system (Cycle Time CSV).',
    required: true,
    columns: 'Created At, Date, Hour, Location, Paylocity Id, Log Type, Item Id, Action, Program, Program Type, Size',
  },
] as const

export default function ImportPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Import Data"
        description="Upload CSVs in order. Each step depends on the one before it."
      />

      <div className="space-y-6">
        {IMPORT_STEPS.map(({ step, title, fileType, description, columns }) => (
          <div key={fileType} className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {step}
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-base font-semibold">{title}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium">Required columns:</span> {columns}
                  </p>
                </div>
                <CSVUploader fileType={fileType} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium">Re-importing is safe.</p>
        <p className="mt-1 text-xs">
          Employees and UPH standards upsert on conflict — re-uploading updates existing records.
          Action logs skip exact duplicates so the same file can be uploaded twice without double-counting.
        </p>
      </div>
    </div>
  )
}
