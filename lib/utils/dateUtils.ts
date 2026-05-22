import {
  parseISO,
  differenceInSeconds,
  differenceInMinutes,
  format,
  startOfDay,
  endOfDay,
  isWithinInterval,
} from 'date-fns'

// ============================================================
// Timestamp Parsing
// ============================================================

/**
 * Parses the warehouse system's ISO 8601 UTC timestamp string.
 * Example input: "2026-05-15T12:20:48.920Z"
 * Always returns UTC Date — never converts to local time at parse.
 */
export function parseEventTimestamp(raw: string): Date {
  return parseISO(raw)
}

/**
 * Parses a CSV date string in the formats used by the warehouse exports.
 * Handles: "2026-05-15", "May 15, 2026", "5/15/26"
 */
export function parseCsvDate(raw: string): Date {
  // Try ISO format first (most reliable)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return parseISO(raw)

  // "May 15, 2026" format
  const longFormat = new Date(raw)
  if (!isNaN(longFormat.getTime())) return longFormat

  // "5/15/26" format — assume 2000s
  const parts = raw.split('/')
  if (parts.length === 3) {
    const year = parseInt(parts[2]) < 100 ? 2000 + parseInt(parts[2]) : parseInt(parts[2])
    return new Date(year, parseInt(parts[0]) - 1, parseInt(parts[1]))
  }

  throw new Error(`Unable to parse date string: "${raw}"`)
}

/**
 * Converts the hour label from CSV ("5 AM", "12 PM") to a 24-hour integer.
 */
export function parseHourLabel(label: string): number {
  const cleaned = label.trim().toUpperCase()
  const match = cleaned.match(/^(\d+)\s*(AM|PM)$/)
  if (!match) throw new Error(`Unrecognized hour label: "${label}"`)

  let hour = parseInt(match[1])
  const period = match[2]

  if (period === 'AM') {
    return hour === 12 ? 0 : hour
  } else {
    return hour === 12 ? 12 : hour + 12
  }
}

/**
 * Formats a Date to "9 AM" / "2 PM" label for display.
 */
export function formatHourLabel(date: Date): string {
  return format(date, 'h aa').replace('AM', 'AM').replace('PM', 'PM')
}

// ============================================================
// Cycle Time Math
// ============================================================

/**
 * Calculates the time delta between two consecutive action events in seconds.
 * Returns null if the gap exceeds the indirect time threshold (likely a break,
 * not a slow cycle) — callers should check for null before flagging.
 */
export function calcCycleSeconds(
  earlier: Date,
  later: Date,
  maxGapMinutes: number = 30
): number | null {
  const minutes = differenceInMinutes(later, earlier)
  if (minutes > maxGapMinutes) return null // This gap is indirect time, not a slow cycle

  return differenceInSeconds(later, earlier)
}

/**
 * Computes the ratio of actual cycle time to standard.
 * ratio > 1.0 means slower than standard; < 1.0 means faster.
 */
export function calcCycleRatio(actualSeconds: number, standardSeconds: number): number {
  if (standardSeconds <= 0) return 0
  return actualSeconds / standardSeconds
}

// ============================================================
// Shift Duration
// ============================================================

/**
 * Returns hours worked between two timestamps.
 * Used when actual clock-in/out is unavailable and we estimate
 * from first/last action timestamps.
 */
export function calcHoursActive(start: Date, end: Date): number {
  const seconds = differenceInSeconds(end, start)
  return Math.max(0, seconds / 3600)
}

/**
 * Returns whether a given timestamp falls within a shift window.
 */
export function isWithinShift(timestamp: Date, shiftStart: Date, shiftEnd: Date): boolean {
  return isWithinInterval(timestamp, { start: shiftStart, end: shiftEnd })
}

// ============================================================
// Display Formatting
// ============================================================

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'MMM d, yyyy')
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'MMM d, yyyy h:mm a')
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}
