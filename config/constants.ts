// ============================================================
// MeetOPS Global Constants
// These are the operational thresholds and configuration values
// used across all tools. Changing a value here changes behavior
// everywhere simultaneously — be deliberate.
//
// For per-site overrides, set the corresponding env variable.
// ============================================================

export const APP_CONFIG = {
  // The physical warehouse location this instance serves
  DEFAULT_LOCATION: process.env.NEXT_PUBLIC_DEFAULT_LOCATION ?? 'Mesa',

  // The data ingestion mode — "csv" for manual uploads, "live" for API feed
  DATA_SOURCE: (process.env.DATA_SOURCE ?? 'csv') as 'csv' | 'live',
} as const

// ============================================================
// UPH / Performance Thresholds
// Used by UPH tracker and coaching trigger logic.
// PPH = Points Per Hour (equivalent to UPH in this context)
// ============================================================

export const PERFORMANCE_THRESHOLDS = {
  // Employees at or above this % of standard are considered "on target"
  ON_TARGET_PERCENT: 95,

  // Between WATCH and ON_TARGET → amber / watch status
  WATCH_PERCENT: 80,

  // Below this % of standard → red / needs attention
  // This is also the threshold that auto-suggests a coaching session
  COACHING_TRIGGER_PERCENT: 80,

  // Minimum hours worked before PPH is considered statistically meaningful
  // Prevents a 20-minute partial shift from showing as 500 PPH
  MIN_HOURS_FOR_PPH: 2,
} as const

// ============================================================
// Cycle Time Thresholds
// Used by the cycle time computation to decide what gets flagged.
// ratio = actualSeconds / standardSeconds
// ============================================================

export const CYCLE_TIME_THRESHOLDS = {
  // Cycle times above this multiple of standard are flagged
  FLAG_RATIO: 2.0,

  // Gaps above this duration (minutes) are classified as indirect time,
  // not counted as an abnormally slow cycle
  INDIRECT_GAP_MINUTES: 30,

  // Minimum consecutive same-action samples required before flagging
  // Prevents a single slow event from skewing the coaching picture
  MIN_SAMPLES_FOR_FLAG: 3,
} as const

// ============================================================
// Shift Planning
// Used by the shift planner to calculate headcount requirements.
// ============================================================

export const SHIFT_CONFIG = {
  // Standard hours per shift — used when scheduled times aren't available
  DEFAULT_SHIFT_HOURS: 10,

  // Hours of the day the facility operates (24hr format)
  FACILITY_OPEN_HOUR: 5,   // 5 AM
  FACILITY_CLOSE_HOUR: 19, // 7 PM

  // Minimum headcount per active department during operating hours
  MIN_HEADCOUNT_PER_DEPT: 1,

  // Workers operate at ~85% of theoretical max throughput due to walk time,
  // indirect tasks, breaks, etc. Headcount = actions / (UPH × hours × UTILIZATION_FACTOR).
  UTILIZATION_FACTOR: 0.85,

  // Default UPH for Processing (RC SORTABLE is ~97% of volume at 65 UPH).
  PROCESSING_DEFAULT_UPH: 65,

  // Default UPH for Returns clerks.
  RETURNS_DEFAULT_UPH: 40,

  // Default UPH for Put Away (Item Putaway action).
  // Put Away needed headcount = ceil(Processing output / Put Away UPH).
  // Both UPH values have the same hours × utilization factor so they cancel,
  // leaving: ceil(processingEff × PROCESSING_DEFAULT_UPH / PUTAWAY_DEFAULT_UPH).
  PUTAWAY_DEFAULT_UPH: 65,

  // 1 Material Handler is needed for every N Processors on the line.
  // MH needed = ceil(processingEffective / MH_PROCESSORS_RATIO).
  MH_PROCESSORS_RATIO: 4,
} as const

// ============================================================
// Coaching
// ============================================================

export const COACHING_CONFIG = {
  // Number of days a coaching session window stays open before auto-escalating
  SESSION_ESCALATION_DAYS: 7,

  // Maximum active trainees one trainer can be assigned simultaneously
  MAX_TRAINEES_PER_TRAINER: 3,
} as const

// ============================================================
// Job Title → Department mapping
// Used by shift planner to group employees into plannable units.
// ============================================================

// ============================================================
// Shift Plan Quarters
// The 4 staffing periods within a shift day. Each quarter has a
// start hour (24h) and a range of hours used for historical demand
// aggregation. label is displayed in the UI.
// ============================================================

export const SHIFT_QUARTERS = [
  { quarter: 1, label: 'Q1 · 5 AM',  startHour: 5,  hours: [5, 6, 7] },
  { quarter: 2, label: 'Q2 · 8 AM',  startHour: 8,  hours: [8, 9, 10] },
  { quarter: 3, label: 'Q3 · 11 AM', startHour: 11, hours: [11, 12, 13, 14] },
  { quarter: 4, label: 'Q4 · 3 PM',  startHour: 15, hours: [15, 16, 17, 18] },
] as const

export type ShiftQuarter = typeof SHIFT_QUARTERS[number]['quarter']

// ============================================================
// Departments used in shift planning (derived from DEPARTMENT_MAP)
// Excludes Management and Safety — these are not headcount-planned
// the same way as production departments.
// ============================================================

export const PRODUCTION_DEPARTMENTS = [
  'Picking', 'Processing', 'Customer Service', 'Put Away',
  'Returns', 'Material Handling',
] as const

export type ProductionDepartment = typeof PRODUCTION_DEPARTMENTS[number]

// ============================================================
// Job Title → Department mapping
// Used by shift planner to group employees into plannable units.
// Load Out and Lot Attendant both map to Customer Service.
// ============================================================

export const DEPARTMENT_MAP: Record<string, string> = {
  'Picker': 'Picking',
  'Inventory Processor': 'Processing',
  'Load Out': 'Customer Service',
  'Put Away': 'Put Away',
  'Lot Attendant': 'Customer Service',
  'Returns Clerk': 'Returns',
  'Material Handler': 'Material Handling',
  'Area Manager': 'Management',
  'Safety Coordinator': 'Safety',
} as const
