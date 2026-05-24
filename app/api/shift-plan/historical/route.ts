import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { APP_CONFIG, SHIFT_QUARTERS } from '@/config/constants'

// GET /api/shift-plan/historical?date=YYYY-MM-DD&location=Mesa
// Returns 6-week same-weekday average headcount needed per dept per quarter.
// Uses hourly_action_totals (pre-aggregated) instead of joining raw action_logs.
// Size-weighted UPH: 70% small / 25% medium / 3.5% large / 1.5% x-large.
// For program-variant actions, prefers RC SORTABLE standard (dominant ~97% of volume).
export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  const location = searchParams.get('location') ?? APP_CONFIG.DEFAULT_LOCATION

  const quarterCases = SHIFT_QUARTERS.map(
    (q) => `WHEN hat.hour IN (${q.hours.join(',')}) THEN ${q.quarter}`
  ).join(' ')

  const quarterHoursCases = SHIFT_QUARTERS.map(
    (q) => `WHEN ${q.quarter} THEN ${q.hours.length}`
  ).join(' ')

  const rows = await db.execute(sql.raw(`
    WITH same_weekday_dates AS (
      SELECT DISTINCT hat.date
      FROM hourly_action_totals hat
      WHERE EXTRACT(DOW FROM hat.date::date) = EXTRACT(DOW FROM '${date}'::date)
        AND hat.date < '${date}'
        AND hat.location = '${location}'
      ORDER BY hat.date DESC
      LIMIT 6
    ),
    size_weighted_uph AS (
      -- Compute a single weighted UPH per action:
      -- Size-variant actions (no program_profile): apply 70/25/3.5/1.5 weighting.
      -- Program-variant actions (no item_size): prefer RC SORTABLE, else average.
      -- Actions with neither dimension: use their UPH directly.
      SELECT
        UPPER(action) AS action_upper,
        CASE
          WHEN MAX(item_size::text) IS NOT NULL AND MAX(program_profile) IS NULL THEN
            MAX(CASE WHEN item_size = 'small'   THEN uph::float ELSE 0 END) * 0.70 +
            MAX(CASE WHEN item_size = 'medium'  THEN uph::float ELSE 0 END) * 0.25 +
            MAX(CASE WHEN item_size = 'large'   THEN uph::float ELSE 0 END) * 0.035 +
            MAX(CASE WHEN item_size = 'x-large' THEN uph::float ELSE 0 END) * 0.015
          WHEN MAX(program_profile) IS NOT NULL THEN
            COALESCE(
              MAX(CASE WHEN program_profile = 'RC SORTABLE' THEN uph::float ELSE NULL END),
              AVG(uph::float)
            )
          ELSE MAX(uph::float)
        END AS weighted_uph
      FROM uph_standards
      GROUP BY UPPER(action)
    ),
    per_date_quarter AS (
      SELECT
        hat.date,
        hat.department,
        CASE ${quarterCases} END AS quarter,
        CASE ${quarterCases} END AS quarter_key,
        SUM(hat.total_count) AS total_actions,
        SUM(hat.total_count::float * COALESCE(sw.weighted_uph, 60)) /
          NULLIF(SUM(hat.total_count), 0) AS weighted_uph,
        CASE ${quarterHoursCases} END AS quarter_hours
      FROM hourly_action_totals hat
      LEFT JOIN size_weighted_uph sw ON UPPER(hat.action) = sw.action_upper
      WHERE hat.date IN (SELECT date FROM same_weekday_dates)
        AND hat.location = '${location}'
      GROUP BY hat.date, hat.department, quarter, quarter_key, quarter_hours
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
      WHERE quarter IS NOT NULL
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
