import Papa from 'papaparse'

// ============================================================
// Coaching CSV Format (flat weekly report)
// Columns: FLAGS, LOCATION, LOCATION ID, EMPLOYEE, EMPLOYEE CARGO ID,
//   EMPLOYEE PAYLOCITY ID, EMPLOYEE COMPANY ID, JOB TITLE, SUPERVISOR CARGO ID,
//   SUPERVISOR, DIRECT HOURS, INDIRECT HOURS, ADMIN HOURS, GAP HOURS,
//   TOTAL HOURS, PUNCH HOURS, POINTS, PPH, GAP %, TENURE
//
// One row per employee, already aggregated for the week.
// GAP % is stored as a decimal (0.15 = 15%).
// Names and job titles are ALL CAPS — converted to title case here.
// ============================================================

interface RawRow {
  FLAGS: string
  LOCATION: string
  EMPLOYEE: string
  'JOB TITLE': string
  SUPERVISOR: string
  'DIRECT HOURS': string
  'INDIRECT HOURS': string
  'ADMIN HOURS': string
  'TOTAL HOURS': string
  PPH: string
  'GAP %': string
  TENURE: string
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function num(s: string): number {
  return parseFloat(s?.trim()) || 0
}

// Job titles eligible for the coaching threshold check.
// Purely indirect/admin roles (AM, Safety, Admin) are excluded.
const PRODUCTION_TITLES = new Set([
  'PICKER',
  'INVENTORY PROCESSOR',
  'LOAD OUT',
  'PUT AWAY',
  'RETURNS CLERK',
  'MATERIAL HANDLER',
  'LOT ATTENDANT',
])

export interface ParsedCoachingRow {
  employeeName: string
  managerName: string
  jobTitle: string
  pph: number
  gapPct: number       // as percentage (e.g., 15.41, not 0.1541)
  directPct: number
  indirectPct: number
  adminPct: number
  totalHours: number
}

export interface CoachingCandidate {
  managerName: string
  employeeName: string
  jobTitle: string
  avgPph: number
  avgGapPct: number
  avgDirectPct: number
  avgIndirectPct: number
  avgAdminPct: number
  avgHours: number
  daysInSample: number  // always 1 for this flat weekly format
}

export function parseCoachingCsv(csvText: string): ParsedCoachingRow[] {
  const result = Papa.parse<RawRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const rows: ParsedCoachingRow[] = []

  for (const raw of result.data) {
    const jobTitleRaw = (raw['JOB TITLE'] ?? '').trim().toUpperCase()

    // Skip non-production roles
    if (!PRODUCTION_TITLES.has(jobTitleRaw)) continue

    const totalHours = num(raw['TOTAL HOURS'])
    if (totalHours <= 0) continue

    const directHours = num(raw['DIRECT HOURS'])
    const indirectHours = num(raw['INDIRECT HOURS'])
    const adminHours = num(raw['ADMIN HOURS'])

    // GAP % is stored as a decimal — convert to percentage
    const gapPct = num(raw['GAP %']) * 100

    rows.push({
      employeeName: toTitleCase(raw.EMPLOYEE?.trim() ?? ''),
      managerName: toTitleCase(raw.SUPERVISOR?.trim() ?? ''),
      jobTitle: toTitleCase(jobTitleRaw),
      pph: num(raw.PPH),
      gapPct,
      directPct: totalHours > 0 ? (directHours / totalHours) * 100 : 0,
      indirectPct: totalHours > 0 ? (indirectHours / totalHours) * 100 : 0,
      adminPct: totalHours > 0 ? (adminHours / totalHours) * 100 : 0,
      totalHours,
    })
  }

  return rows
}

// Filter rows against coaching thresholds and return structured candidates.
// Thresholds:
//   - Skip anyone with PPH = 0 (all-indirect week — not a production performance issue)
//   - Returns Clerk: PPH < 36
//   - All other production roles: PPH < 100 OR gapPct > 10
export function filterCandidates(rows: ParsedCoachingRow[]): CoachingCandidate[] {
  return rows
    .filter((r) => {
      if (r.pph === 0) return false   // no production work this week
      if (r.jobTitle === 'Returns Clerk') return r.pph < 36
      return r.pph < 100 || r.gapPct > 10
    })
    .map((r) => ({
      managerName: r.managerName,
      employeeName: r.employeeName,
      jobTitle: r.jobTitle,
      avgPph: Math.round(r.pph * 100) / 100,
      avgGapPct: Math.round(r.gapPct * 100) / 100,
      avgDirectPct: Math.round(r.directPct * 100) / 100,
      avgIndirectPct: Math.round(r.indirectPct * 100) / 100,
      avgAdminPct: Math.round(r.adminPct * 100) / 100,
      avgHours: Math.round(r.totalHours * 100) / 100,
      daysInSample: 1,
    }))
}
