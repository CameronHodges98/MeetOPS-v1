import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { APP_CONFIG, SHIFT_QUARTERS } from '@/config/constants'

// GET /api/shift-plan/historical?date=YYYY-MM-DD
// Returns the 6-week same-weekday average headcount needed per dept per quarter.
// Formula: avg(total_actions_in_quarter) / (weighted_avg_uph * quarter_hours)
export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  const location = searchParams.get('location') ?? APP_CONFIG.DEFAULT_LOCATION

  // Build quarter hour mapping for SQL CASE expressions
  const quarterHourCases = SHIFT_QUARTERS.map(
    (q) => `WHEN hour_int IN (${q.hours.join(',')}) THEN ${q.quarter}`
  ).join(' ')

  const quarterHoursCases = SHIFT_QUARTERS.map(
    (q) => `WHEN ${q.quarter} THEN ${q.hours.length}`
  ).join(' ')

  const hourLabelToInt = `
    CASE al.hour
      WHEN '5 AM' THEN 5  WHEN '6 AM' THEN 6  WHEN '7 AM' THEN 7
      WHEN '8 AM' THEN 8  WHEN '9 AM' THEN 9  WHEN '10 AM' THEN 10
      WHEN '11 AM' THEN 11 WHEN '12 PM' THEN 12
      WHEN '1 PM' THEN 13 WHEN '2 PM' THEN 14 WHEN '3 PM' THEN 15
      WHEN '4 PM' THEN 16 WHEN '5 PM' THEN 17 WHEN '6 PM' THEN 18
      ELSE NULL
    END
  `

  const rows = await db.execute(sql.raw(`
    WITH same_weekday_dates AS (
      SELECT DISTINCT al.date
      FROM action_logs al
      WHERE EXTRACT(DOW FROM al.date::date) = EXTRACT(DOW FROM '${date}'::date)
        AND al.date < '${date}'
        AND al.location = '${location}'
      ORDER BY al.date DESC
      LIMIT 6
    ),
    dept_actions AS (
      SELECT
        al.date,
        CASE e.job_title
          WHEN 'Picker'              THEN 'Picking'
          WHEN 'Inventory Processor' THEN 'Processing'
          WHEN 'Load Out'            THEN 'Load Out'
          WHEN 'Put Away'            THEN 'Put Away'
          WHEN 'Lot Attendant'       THEN 'Lot'
          WHEN 'Returns Clerk'       THEN 'Returns'
          WHEN 'Material Handler'    THEN 'Material Handling'
        END AS department,
        ${hourLabelToInt} AS hour_int,
        al.action,
        COALESCE(u.uph, 60) AS standard_uph
      FROM action_logs al
      JOIN employees e ON al.employee_id = e.id
      LEFT JOIN uph_standards u
        ON UPPER(al.action) = UPPER(u.action)
        AND (u.item_size IS NULL OR u.item_size = al.size)
      WHERE al.date IN (SELECT date FROM same_weekday_dates)
        AND e.job_title NOT IN ('Area Manager', 'Safety Coordinator')
        AND e.status = 'active'
    ),
    with_quarter AS (
      SELECT
        date,
        department,
        action,
        standard_uph,
        CASE ${quarterHourCases} ELSE NULL END AS quarter
      FROM dept_actions
      WHERE hour_int IS NOT NULL AND department IS NOT NULL
    ),
    action_totals AS (
      SELECT
        date,
        department,
        quarter,
        action,
        standard_uph,
        COUNT(*) AS action_count
      FROM with_quarter
      WHERE quarter IS NOT NULL
      GROUP BY date, department, quarter, action, standard_uph
    ),
    per_date_quarter AS (
      SELECT
        date,
        department,
        quarter,
        SUM(action_count) AS total_actions,
        SUM(action_count::float * standard_uph) / NULLIF(SUM(action_count), 0) AS weighted_uph,
        CASE ${quarterHoursCases} END AS quarter_hours
      FROM action_totals
      GROUP BY date, department, quarter
    ),
    headcount_per_date AS (
      SELECT
        date,
        department,
        quarter,
        total_actions,
        weighted_uph,
        quarter_hours,
        CEIL(total_actions::float / NULLIF(weighted_uph * quarter_hours, 0)) AS headcount_needed
      FROM per_date_quarter
    )
    SELECT
      department,
      quarter,
      ROUND(AVG(headcount_needed)) AS avg_headcount_needed,
      ROUND(AVG(total_actions))    AS avg_total_actions,
      ROUND(AVG(weighted_uph))     AS avg_uph,
      COUNT(DISTINCT date)         AS data_points
    FROM headcount_per_date
    GROUP BY department, quarter
    ORDER BY department, quarter
  `))

  return Response.json(rows)
}
