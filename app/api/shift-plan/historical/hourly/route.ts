import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { APP_CONFIG, SHIFT_CONFIG } from '@/config/constants'

// GET /api/shift-plan/historical/hourly?date=YYYY-MM-DD&location=Mesa
// Returns 6-week same-weekday average headcount needed per dept per HOUR.
// Used by QuarterDrawer for the hour-by-hour breakdown — real data, not divided estimates.
// Headcount = CEIL(hour_actions / (weighted_UPH × 1 hour × UTILIZATION_FACTOR))
export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  const location = searchParams.get('location') ?? APP_CONFIG.DEFAULT_LOCATION

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
    per_date_hour AS (
      SELECT
        hat.date,
        hat.department,
        hat.hour,
        SUM(hat.total_count) AS total_actions,
        SUM(hat.total_count::float * COALESCE(sw.weighted_uph, 60)) /
          NULLIF(SUM(hat.total_count), 0) AS weighted_uph
      FROM hourly_action_totals hat
      LEFT JOIN size_weighted_uph sw ON UPPER(hat.action) = sw.action_upper
      WHERE hat.date IN (SELECT date FROM same_weekday_dates)
        AND hat.location = '${location}'
      GROUP BY hat.date, hat.department, hat.hour
    ),
    headcount_per_date AS (
      SELECT
        date,
        department,
        hour,
        total_actions,
        weighted_uph,
        CEIL(total_actions::float /
          NULLIF(weighted_uph * ${SHIFT_CONFIG.UTILIZATION_FACTOR}, 0)
        ) AS headcount_needed
      FROM per_date_hour
    )
    SELECT
      department,
      hour,
      ROUND(AVG(headcount_needed)) AS avg_headcount_needed,
      ROUND(AVG(total_actions))    AS avg_total_actions,
      ROUND(AVG(weighted_uph))     AS avg_uph,
      COUNT(DISTINCT date)         AS data_points
    FROM headcount_per_date
    GROUP BY department, hour
    ORDER BY department, hour
  `))

  return Response.json(rows.rows)
}
