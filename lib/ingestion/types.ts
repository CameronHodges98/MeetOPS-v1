// ============================================================
// Ingestion Layer Types
// These types define the contract that both the CSV ingestion
// pipeline and the future live feed adapters must fulfill.
// The rest of the application only cares about these types —
// it never knows whether data came from a file or an API.
// ============================================================

export interface IngestionResult {
  success: boolean
  recordsProcessed: number
  recordsInserted: number
  recordsSkipped: number   // Duplicates or rows outside expected range
  recordsFailed: number    // Parse errors or constraint violations
  errors: IngestionError[]
  durationMs: number
  source: 'csv' | 'live'
}

export interface IngestionError {
  row?: number             // CSV row number, if applicable
  field?: string           // The field that caused the error
  value?: unknown          // The raw value that failed
  message: string
}

// The parsed, validated shape of each data type before DB insert.
// These match the DB schema's NewX types but without generated fields
// (id, createdAt, ingestedAt) — those are added at insert time.

export interface ParsedEmployee {
  paylocityId: string
  cargoId?: number
  name: string
  jobTitle: string
  location: string
  status: 'active' | 'inactive' | 'on_leave'
  supervisorName?: string  // Resolved to supervisorId at insert time
}

export interface ParsedActionLog {
  employeePaylocityId: string  // Resolved to employeeId at insert time
  createdAt: Date
  date: string
  hour: string
  location: string
  logType: 'appointment' | 'item' | 'container'
  itemId?: number
  action: string
  program?: string
  programType?: string
  size?: 'small' | 'medium' | 'large' | 'x-large'
}

export interface ParsedUphStandard {
  action: string
  location: string
  itemSize?: string
  programProfile?: string
  secPerAction: number
  pointsPerAction: number
  uph: number
}

export interface ParsedShift {
  employeePaylocityId: string
  date: string
  scheduledStart?: Date
  scheduledEnd?: Date
  department?: string
  absenceCode?: string
  isOt: boolean
}

export interface ParsedAppointment {
  location: string
  appointmentDate: string
  hour: number
  appointmentCount: number
}

export interface ParsedThroughput {
  programName: string
  processedDate: string
  itemsProcessed: number
}
