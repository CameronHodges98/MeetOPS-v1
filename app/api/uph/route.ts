import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('from')
  const dateTo = searchParams.get('to')
  const jobTitle = searchParams.get('jobTitle')

  if (!dateFrom || !dateTo) {
    return NextResponse.json(
      { error: 'from and to date parameters are required (YYYY-MM-DD)' },
      { status: 400 }
    )
  }

  // Raw SQL aggregate: join action_logs to uph_standards to get points per row,
  // then sum by employee for the date range.
  // standardHours = time employee would spend if working at exact standard speed
  // on their actual action mix. Used to compute efficiency % on the client.
  const result = await db.execute(sql`
    SELECT
      e.id AS "employeeId",
      e.name AS "employeeName",
      e.job_title AS "jobTitle",
      e.paylocity_id AS "paylocityId",
      COALESCE(SUM(u.points_per_action::numeric), 0) AS "totalPoints",
      COUNT(al.id) AS "totalActions",
      COUNT(DISTINCT al.date) AS "daysWorked",
      COALESCE(SUM(u.sec_per_action::numeric / 3600), 0) AS "standardHours"
    FROM employees e
    LEFT JOIN action_logs al
      ON al.employee_id = e.id
      AND al.date >= ${dateFrom}
      AND al.date <= ${dateTo}
    LEFT JOIN uph_standards u
      ON UPPER(al.action) = UPPER(u.action)
      AND (u.item_size IS NULL OR u.item_size = al.size)
      AND (u.program_profile IS NULL OR UPPER(u.program_profile) = UPPER(al.program_type))
    WHERE e.status = 'active'
    ${jobTitle ? sql`AND e.job_title = ${jobTitle}` : sql``}
    GROUP BY e.id, e.name, e.job_title, e.paylocity_id
    ORDER BY "totalPoints" DESC
  `)

  return NextResponse.json(result.rows)
}
