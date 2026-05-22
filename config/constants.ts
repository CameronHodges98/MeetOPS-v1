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
  FACILITY_OPEN_HOUR: 4,   // 4 AM
  FACILITY_CLOSE_HOUR: 22, // 10 PM

  // Minimum headcount per active department during operating hours
  MIN_HEADCOUNT_PER_DEPT: 1,
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

export const DEPARTMENT_MAP: Record<string, string> = {
  'Picker': 'Picking',
  'Inventory Processor': 'Processing',
  'Load Out': 'Load Out',
  'Put Away': 'Put Away',
  'Lot Attendant': 'Lot',
  'Returns Clerk': 'Returns',
  'Material Handler': 'Material Handling',
  'Area Manager': 'Management',
  'Safety Coordinator': 'Safety',
} as const
