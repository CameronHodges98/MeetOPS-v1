import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { APP_CONFIG } from '@/config/constants'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('from')
  const dateTo = searchParams.get('to')
  const jobTitle = searchParams.get('jobTitle')
  const location = searchParams.get('location') ?? APP_CONFIG.DEFAULT_LOCATION

  if (!dateFrom || !dateTo) {
    return NextResponse.json(
      { error: 'from and to date parameters are required (YYYY-MM-DD)' },
      { status: 400 }
    )
  }

  try {
    const result = await db.execute(sql.raw(`
      WITH blended_standards AS (
        -- Compute a single weighted points_per_action and sec_per_action per action type.
        -- Same blending logic as the historical endpoint:
        --   Size-variant actions: 70/25/3.5/1.5 (S/M/L/XL) blend.
        --   Program-variant actions: prefer RC SORTABLE, else average.
        --   Neither: use the single row directly.
        -- This eliminates JOIN fanout from multiple matching rows per action_log entry.
        SELECT
          UPPER(action) AS action_upper,
          CASE
            WHEN MAX(item_size::text) IS NOT NULL AND MAX(program_profile) IS NULL THEN
              MAX(CASE WHEN item_size = 'small'   THEN points_per_action::float ELSE 0 END) * 0.70 +
              MAX(CASE WHEN item_size = 'medium'  THEN points_per_action::float ELSE 0 END) * 0.25 +
              MAX(CASE WHEN item_size = 'large'   THEN points_per_action::float ELSE 0 END) * 0.035 +
              MAX(CASE WHEN item_size = 'x-large' THEN points_per_action::float ELSE 0 END) * 0.015
            WHEN MAX(program_profile) IS NOT NULL THEN
              COALESCE(
                MAX(CASE WHEN program_profile = 'RC SORTABLE' THEN points_per_action::float ELSE NULL END),
                AVG(points_per_action::float)
              )
            ELSE MAX(points_per_action::float)
          END AS weighted_points,
          CASE
            WHEN MAX(item_size::text) IS NOT NULL AND MAX(program_profile) IS NULL THEN
              MAX(CASE WHEN item_size = 'small'   THEN sec_per_action::float ELSE 0 END) * 0.70 +
              MAX(CASE WHEN item_size = 'medium'  THEN sec_per_action::float ELSE 0 END) * 0.25 +
              MAX(CASE WHEN item_size = 'large'   THEN sec_per_action::float ELSE 0 END) * 0.035 +
              MAX(CASE WHEN item_size = 'x-large' THEN sec_per_action::float ELSE 0 END) * 0.015
            WHEN MAX(program_profile) IS NOT NULL THEN
              COALESCE(
                MAX(CASE WHEN program_profile = 'RC SORTABLE' THEN sec_per_action::float ELSE NULL END),
                AVG(sec_per_action::float)
              )
            ELSE MAX(sec_per_action::float)
          END AS weighted_sec
        FROM uph_standards
        GROUP BY UPPER(action)
      )
      SELECT
        e.id              AS "employeeId",
        e.name            AS "employeeName",
        e.job_title       AS "jobTitle",
        e.paylocity_id    AS "paylocityId",
        COALESCE(SUM(bs.weighted_points), 0)        AS "totalPoints",
        COUNT(al.id)                                AS "totalActions",
        COUNT(DISTINCT al.date)                     AS "daysWorked",
        COALESCE(SUM(bs.weighted_sec / 3600.0), 0)  AS "standardHours"
      FROM employees e
      LEFT JOIN action_logs al
        ON al.employee_id = e.id
        AND al.date >= '${dateFrom}'
        AND al.date <= '${dateTo}'
        ${location !== '' ? `AND al.location = '${location}'` : ''}
      LEFT JOIN blended_standards bs ON UPPER(al.action) = bs.action_upper
      WHERE e.status = 'active'
      ${jobTitle ? `AND e.job_title = '${jobTitle.replace(/'/g, "''")}'` : ''}
      GROUP BY e.id, e.name, e.job_title, e.paylocity_id
      ORDER BY "totalPoints" DESC
    `))

    return NextResponse.json(result.rows)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/uph] query error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
