import Papa from 'papaparse'

export interface CoachingCsvRow {
  date: string         // yyyy-MM-dd
  managerName: string
  jobTitle: string
  employeeName: string
  points: number
  hours: number
  pph: number
  gapPct: number
  directPct: number
  indirectPct: number
  adminPct: number
}

interface RawCsvRow {
  Group: string
  Points: string
  Hours: string
  'PPH': string
  'Gap %': string
  'Direct %': string
  'Indirect %': string
  'Admin %': string
}

function parsePercent(s: string): number {
  return parseFloat(s.replace('%', '').trim()) || 0
}

function parseNum(s: string): number {
  return parseFloat(s.trim()) || 0
}

// Parse a Group cell like " -> Mesa -> 2026-05-11 -> Manager Name -> Job Title -> Employee"
// Returns depth (number of segments after stripping leading whitespace) and the parts
function parseGroup(group: string): { depth: number; parts: string[] } {
  const parts = group
    .split('->')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  return { depth: parts.length, parts }
}

export function parseCoachingCsv(csvText: string): CoachingCsvRow[] {
  const result = Papa.parse<RawCsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const rows: CoachingCsvRow[] = []

  for (const raw of result.data) {
    const { depth, parts } = parseGroup(raw.Group ?? '')

    // Only employee-level rows: Mesa -> date -> manager -> jobTitle -> employee (depth 5)
    if (depth !== 5) continue

    // parts: [location, date, managerName, jobTitle, employeeName]
    const [, date, managerName, jobTitle, employeeName] = parts

    // Skip rows with zero hours (inactive / no data)
    const hours = parseNum(raw.Hours)
    if (hours <= 0) continue

    rows.push({
      date,
      managerName,
      jobTitle,
      employeeName,
      points: parseNum(raw.Points),
      hours,
      pph: parseNum(raw['PPH']),
      gapPct: parsePercent(raw['Gap %']),
      directPct: parsePercent(raw['Direct %']),
      indirectPct: parsePercent(raw['Indirect %']),
      adminPct: parsePercent(raw['Admin %']),
    })
  }

  return rows
}

export interface AggregatedCandidate {
  managerName: string
  employeeName: string
  jobTitle: string
  avgPph: number
  avgGapPct: number
  avgDirectPct: number
  avgIndirectPct: number
  avgAdminPct: number
  avgHours: number
  daysInSample: number
}

// Aggregate multiple days for the same employee under the same manager, then
// apply thresholds to determine candidates for coaching.
// Thresholds:
//   - Most roles: avgPph < 100 OR avgGapPct > 10
//   - Returns Clerk: avgPph < 36
export function aggregateAndFilterCandidates(rows: CoachingCsvRow[]): AggregatedCandidate[] {
  // Key: employeeName + '|' + managerName (same employee may move between managers rarely)
  const map = new Map<string, { rows: CoachingCsvRow[] }>()

  for (const row of rows) {
    const key = `${row.employeeName}|${row.managerName}`
    if (!map.has(key)) map.set(key, { rows: [] })
    map.get(key)!.rows.push(row)
  }

  const candidates: AggregatedCandidate[] = []

  for (const [, { rows: empRows }] of map) {
    const first = empRows[0]
    const n = empRows.length

    const avg = (fn: (r: CoachingCsvRow) => number) =>
      empRows.reduce((sum, r) => sum + fn(r), 0) / n

    const avgPph = avg((r) => r.pph)
    const avgGapPct = avg((r) => r.gapPct)

    const isReturnsClerk = first.jobTitle === 'Returns Clerk'
    const qualifies = isReturnsClerk
      ? avgPph < 36
      : avgPph < 100 || avgGapPct > 10

    if (!qualifies) continue

    candidates.push({
      managerName: first.managerName,
      employeeName: first.employeeName,
      jobTitle: first.jobTitle,
      avgPph: Math.round(avgPph * 100) / 100,
      avgGapPct: Math.round(avgGapPct * 100) / 100,
      avgDirectPct: Math.round(avg((r) => r.directPct) * 100) / 100,
      avgIndirectPct: Math.round(avg((r) => r.indirectPct) * 100) / 100,
      avgAdminPct: Math.round(avg((r) => r.adminPct) * 100) / 100,
      avgHours: Math.round(avg((r) => r.hours) * 100) / 100,
      daysInSample: n,
    })
  }

  return candidates
}

// Derive week start/end from the dates in the parsed rows
export function getWeekBounds(rows: CoachingCsvRow[]): { weekStart: string; weekEnd: string } {
  const dates = rows.map((r) => r.date).filter(Boolean).sort()
  return {
    weekStart: dates[0] ?? '',
    weekEnd: dates[dates.length - 1] ?? '',
  }
}
