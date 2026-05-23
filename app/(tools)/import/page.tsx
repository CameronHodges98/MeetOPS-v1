'use client'

import { PageHeader } from '@/components/layout/PageHeader'
import { CSVUploader } from '@/components/shared/CSVUploader'

const IMPORT_STEPS = [
  {
    step: 1,
    title: 'Employee Roster',
    fileType: 'employees' as const,
    description: 'Must be imported first. All other imports match employees by Paylocity ID.',
    fileName: 'Roster.csv',
    columns: 'Single "Group" column — Paylocity hierarchical export from the Paylocity reporting dashboard.',
  },
  {
    step: 2,
    title: 'UPH Standards Scale',
    fileType: 'uph_standards' as const,
    description: 'The benchmark table. Must be imported before action logs.',
    fileName: 'UPH_scale.csv',
    columns: 'ID, ACTION, LOCATION, ITEM SIZE, PROGRAM PROFILE, PROGRAM TYPE, SEC / ACTION, POINTS / ACTION, ACTIONS / HOUR, ACTIVE AT, INACTIVE AT',
  },
  {
    step: 3,
    title: 'Action Logs',
    fileType: 'action_logs' as const,
    description: 'Cycle Time CSV export from the warehouse system.',
    fileName: 'Action_Log_Example.csv',
    columns: 'Year, Month, Week, Day, Date, Hour, Created At, Location, Cargo Id, Paylocity Id, Status, Job Title, Employee, Log Type, Item Id, Action, Program, Program Type, Size',
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
        {IMPORT_STEPS.map(({ step, title, fileType, description, fileName, columns }) => (
          <div key={fileType} className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {step}
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold">{title}</h2>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground font-mono">
                      {fileName}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium">Columns:</span> {columns}
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
