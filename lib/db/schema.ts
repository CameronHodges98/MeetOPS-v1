import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  integer,
  real,
  boolean,
  date,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// ============================================================
// ROLES
// ============================================================

export const appRoleEnum = pgEnum('app_role', ['root', 'gm', 'ops', 'am', 'ct'])

// ============================================================
// COACHING — ESCALATION STAGE
// The employee's position on the disciplinary board.
// roster = in the tray, not yet formally coached.
// c1/c2 = 1st and 2nd coaching conversations.
// k1/k2 = 1st and 2nd written corrective actions.
// final  = HR / termination review.
// ============================================================

export const escalationStageEnum = pgEnum('escalation_stage', [
  'roster', 'c1', 'c2', 'k1', 'k2', 'final',
])

// ============================================================
// COACHING — CARD STATUS
// Visual state of an employee's card within their current stage.
// in_progress = yellow, completed = green, exempt = light red.
// ============================================================

export const cardStatusEnum = pgEnum('card_status', [
  'in_progress', 'completed', 'exempt',
])

// ============================================================
// COACHING — APPROVAL TYPE
// What kind of action is waiting for OM/GM sign-off.
// ============================================================

export const approvalTypeEnum = pgEnum('approval_type', [
  'auto_advance', 'manual_move', 'exempt',
])

// ============================================================
// COACHING — APPROVAL STATUS
// ============================================================

export const approvalStatusEnum = pgEnum('approval_status', [
  'pending', 'approved', 'denied',
])

// ============================================================
// COACHING — SESSION STATUS (within the detail drawer)
// Lifecycle of a single CT-assigned coaching session.
// unassigned → assigned → in_coaching → review → complete
// ============================================================

export const coachingStatusEnum = pgEnum('coaching_status', [
  'unassigned', 'assigned', 'in_coaching', 'review', 'complete',
])

// ============================================================
// APP USERS
// Every authorized user of the platform. Created on invite accept.
//
// opsManagerClerkId  — set for AMs, points to their Ops Manager
// areaManagerClerkId — set for CTs, points to their Area Manager
// ============================================================

export const appUsers = pgTable(
  'app_users',
  {
    id: serial('id').primaryKey(),
    clerkId: varchar('clerk_id', { length: 100 }).notNull().unique(),
    email: varchar('email', { length: 200 }).notNull(),
    name: varchar('name', { length: 200 }),
    role: appRoleEnum('role').notNull(),
    opsManagerClerkId: varchar('ops_manager_clerk_id', { length: 100 }),
    areaManagerClerkId: varchar('area_manager_clerk_id', { length: 100 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    clerkIdIdx: uniqueIndex('app_users_clerk_id_idx').on(table.clerkId),
    emailIdx: uniqueIndex('app_users_email_idx').on(table.email),
  })
)

// ============================================================
// INVITES
// One-time sign-up tokens. Expire after 36 hours.
// The email is locked — only the invited address can sign up.
// ============================================================

export const invites = pgTable(
  'invites',
  {
    id: serial('id').primaryKey(),
    token: varchar('token', { length: 100 }).notNull().unique(),
    email: varchar('email', { length: 200 }).notNull(),
    role: appRoleEnum('role').notNull(),
    createdByClerkId: varchar('created_by_clerk_id', { length: 100 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    usedByClerkId: varchar('used_by_clerk_id', { length: 100 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tokenIdx: uniqueIndex('invites_token_idx').on(table.token),
  })
)

// ============================================================
// WAREHOUSES
// ============================================================

export const warehouses = pgTable('warehouses', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ============================================================
// USER PREFERENCES
// ============================================================

export const userPreferences = pgTable('user_preferences', {
  id: serial('id').primaryKey(),
  clerkUserId: varchar('clerk_user_id', { length: 100 }).notNull().unique(),
  defaultWarehouseId: integer('default_warehouse_id').references(() => warehouses.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ============================================================
// SHIFT PLANS
// ============================================================

export const shiftPlans = pgTable(
  'shift_plans',
  {
    id: serial('id').primaryKey(),
    date: date('date').notNull(),
    location: varchar('location', { length: 50 }).notNull().default('Mesa'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedByClerkId: varchar('published_by_clerk_id', { length: 100 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    datLocationIdx: uniqueIndex('shift_plans_date_location_idx').on(table.date, table.location),
  })
)

// ============================================================
// SHIFT PLAN SUBMISSIONS
// ============================================================

export const shiftPlanSubmissions = pgTable(
  'shift_plan_submissions',
  {
    id: serial('id').primaryKey(),
    shiftPlanId: integer('shift_plan_id').notNull().references(() => shiftPlans.id),
    department: varchar('department', { length: 100 }).notNull(),
    calloutCount: integer('callout_count').notNull().default(0),
    otCount: integer('ot_count').notNull().default(0),
    exemptEntries: jsonb('exempt_entries').notNull().default('[]'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    submittedByClerkId: varchar('submitted_by_clerk_id', { length: 100 }),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    planDeptIdx: uniqueIndex('shift_plan_submissions_plan_dept_idx').on(
      table.shiftPlanId,
      table.department
    ),
  })
)

// ============================================================
// FLEX PLAN ENTRIES
// ============================================================

export const flexPlanEntries = pgTable(
  'flex_plan_entries',
  {
    id: serial('id').primaryKey(),
    shiftPlanId: integer('shift_plan_id').notNull().references(() => shiftPlans.id),
    quarter: integer('quarter').notNull(),
    fromDepartment: varchar('from_department', { length: 100 }).notNull(),
    toDepartment: varchar('to_department', { length: 100 }).notNull(),
    headcountMoved: integer('headcount_moved').notNull(),
    notes: varchar('notes', { length: 500 }),
    createdByClerkId: varchar('created_by_clerk_id', { length: 100 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    planIdx: index('flex_plan_entries_plan_idx').on(table.shiftPlanId),
  })
)

// ============================================================
// DEPARTMENT ROSTERS
// ============================================================

export const departmentRosters = pgTable(
  'department_rosters',
  {
    id: serial('id').primaryKey(),
    department: varchar('department', { length: 100 }).notNull(),
    location: varchar('location', { length: 100 }).notNull(),
    count: integer('count').notNull().default(0),
    shiftSchedule: jsonb('shift_schedule'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    updatedByClerkId: varchar('updated_by_clerk_id', { length: 100 }),
  },
  (table) => ({
    deptLocationIdx: uniqueIndex('department_rosters_dept_location_idx').on(table.department, table.location),
  })
)

// ============================================================
// PERFORMANCE WEEKS
// One row per employee per weekly CSV upload.
// Source of truth for the coaching queue and week-over-week
// line charts. Employees qualify for coaching when:
//   directPct >= 40% AND (pph < 100 OR gapPct > 10%)
// ============================================================

export const performanceWeeks = pgTable(
  'performance_weeks',
  {
    id: serial('id').primaryKey(),
    weekDate: date('week_date').notNull(),
    managerName: varchar('manager_name', { length: 200 }).notNull(),
    jobTitle: varchar('job_title', { length: 200 }).notNull(),
    employeeName: varchar('employee_name', { length: 200 }).notNull(),
    pph: real('pph'),
    directPct: real('direct_pct'),
    indirectPct: real('indirect_pct'),
    gapPct: real('gap_pct'),
    uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
    uploadedByClerkId: varchar('uploaded_by_clerk_id', { length: 100 }).notNull(),
  },
  (table) => ({
    weekEmpIdx: uniqueIndex('perf_weeks_week_emp_idx').on(table.weekDate, table.employeeName),
    managerIdx: index('perf_weeks_manager_idx').on(table.managerName),
    weekDateIdx: index('perf_weeks_week_date_idx').on(table.weekDate),
  })
)

// ============================================================
// PERFORMANCE DAYS
// Individual day breakdowns parsed from the same weekly CSV.
// Used for the "bad day / good week" flag cards shown to managers.
// These do NOT trigger coaching sessions on their own.
// ============================================================

export const performanceDays = pgTable(
  'performance_days',
  {
    id: serial('id').primaryKey(),
    weekDate: date('week_date').notNull(),
    dayDate: date('day_date').notNull(),
    employeeName: varchar('employee_name', { length: 200 }).notNull(),
    managerName: varchar('manager_name', { length: 200 }).notNull(),
    jobTitle: varchar('job_title', { length: 200 }).notNull(),
    pph: real('pph'),
    directPct: real('direct_pct'),
    indirectPct: real('indirect_pct'),
    gapPct: real('gap_pct'),
  },
  (table) => ({
    weekDayEmpIdx: uniqueIndex('perf_days_week_day_emp_idx').on(
      table.weekDate,
      table.dayDate,
      table.employeeName
    ),
    weekDateIdx: index('perf_days_week_date_idx').on(table.weekDate),
  })
)

// ============================================================
// CHECKLIST TEMPLATES
// Preset observation checklists used by CTs during coaching.
// items: [{ id: string, category: string, text: string }]
// Universal — any CT can pick any checklist for any employee
// (everyone is cross-trained, so department/job title does not scope them).
// ============================================================

export const checklistTemplates = pgTable('checklist_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  items: jsonb('items').notNull().default('[]'),
  isActive: boolean('is_active').notNull().default(true),
  createdByClerkId: varchar('created_by_clerk_id', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ============================================================
// COACHING ROSTER
// One row per employee tracked on the disciplinary board.
// Tracks where the employee is in their escalation journey and
// aggregates week-over-week consecutive flag/clear counts for
// the 4-week reset rule.
//
// stageHistory (JSONB array):
//   [{ stage, changedAt, changedByClerkId, reason, type: 'auto'|'manual'|'system' }]
// ============================================================

export const coachingRoster = pgTable(
  'coaching_roster',
  {
    id: serial('id').primaryKey(),
    employeeName: varchar('employee_name', { length: 200 }).notNull(),
    managerName: varchar('manager_name', { length: 200 }).notNull(),
    jobTitle: varchar('job_title', { length: 200 }).notNull(),
    currentStage: escalationStageEnum('current_stage').notNull().default('roster'),
    cardStatus: cardStatusEnum('card_status').notNull().default('in_progress'),
    // Trigger snapshot from the week that first placed them here
    triggerPph: real('trigger_pph'),
    triggerGapPct: real('trigger_gap_pct'),
    triggerDirectPct: real('trigger_direct_pct'),
    firstFlaggedWeekDate: date('first_flagged_week_date'),
    lastFlaggedWeekDate: date('last_flagged_week_date'),
    // Consecutive weeks below threshold (drives auto-advance detection)
    consecutiveWeeksFlagged: integer('consecutive_weeks_flagged').notNull().default(0),
    // Consecutive weeks above threshold (drives 4-week reset)
    consecutiveWeeksCleared: integer('consecutive_weeks_cleared').notNull().default(0),
    // Full audit trail of every stage change
    stageHistory: jsonb('stage_history').notNull().default('[]'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // One active roster entry per employee (re-entry after 4-week reset
    // reuses this row, resetting stage and counters)
    activeEmpIdx: uniqueIndex('coaching_roster_active_emp_idx').on(table.employeeName, table.isActive),
    managerIdx: index('coaching_roster_manager_idx').on(table.managerName),
    stageIdx: index('coaching_roster_stage_idx').on(table.currentStage),
  })
)

// ============================================================
// COACHING APPROVALS
// Every action that requires OM/GM sign-off before it takes effect:
//   auto_advance — system detected an employee should move up a stage
//   manual_move  — AM dragged a card to a different stage
//   exempt       — AM marked an employee as exempt
//
// The card does NOT move until status = 'approved'.
// pendingStage is the target stage for auto_advance and manual_move.
// ============================================================

export const coachingApprovals = pgTable(
  'coaching_approvals',
  {
    id: serial('id').primaryKey(),
    rosterEntryId: integer('roster_entry_id').notNull().references(() => coachingRoster.id),
    type: approvalTypeEnum('type').notNull(),
    requestedByClerkId: varchar('requested_by_clerk_id', { length: 100 }).notNull(),
    fromStage: escalationStageEnum('from_stage').notNull(),
    toStage: escalationStageEnum('to_stage'),          // null for exempt requests
    reason: text('reason').notNull(),                   // AM must always provide a reason
    status: approvalStatusEnum('status').notNull().default('pending'),
    reviewedByClerkId: varchar('reviewed_by_clerk_id', { length: 100 }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNotes: text('review_notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    rosterIdx: index('coaching_approvals_roster_idx').on(table.rosterEntryId),
    statusIdx: index('coaching_approvals_status_idx').on(table.status),
    reviewerIdx: index('coaching_approvals_reviewer_idx').on(table.reviewedByClerkId),
  })
)

// ============================================================
// COACHING SESSIONS
// One session per escalation stage per roster entry.
// Tracks the CT assignment and checklist lifecycle within a
// specific stage of an employee's coaching journey.
//
// formData (JSONB):
//   [{ id: string, result: 'pass' | 'fail', comment?: string }]
// ============================================================

export const coachingSessions = pgTable(
  'coaching_sessions',
  {
    id: serial('id').primaryKey(),
    rosterEntryId: integer('roster_entry_id').notNull().references(() => coachingRoster.id),
    escalationStage: escalationStageEnum('escalation_stage').notNull(),
    weekDate: date('week_date').notNull(),              // week that triggered this stage
    employeeName: varchar('employee_name', { length: 200 }).notNull(),
    managerName: varchar('manager_name', { length: 200 }).notNull(),
    jobTitle: varchar('job_title', { length: 200 }).notNull(),
    triggerPph: real('trigger_pph'),
    triggerGapPct: real('trigger_gap_pct'),
    triggerDirectPct: real('trigger_direct_pct'),
    status: coachingStatusEnum('status').notNull().default('unassigned'),
    assignedCtClerkId: varchar('assigned_ct_clerk_id', { length: 100 }),
    assignedByClerkId: varchar('assigned_by_clerk_id', { length: 100 }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    checklistTemplateId: integer('checklist_template_id').references(() => checklistTemplates.id),
    formData: jsonb('form_data'),
    ctNotes: text('ct_notes'),
    managerNotes: text('manager_notes'),
    inCoachingAt: timestamp('in_coaching_at', { withTimezone: true }),
    reviewAt: timestamp('review_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // One session per stage per roster entry
    rosterStageIdx: uniqueIndex('coaching_sessions_roster_stage_idx').on(
      table.rosterEntryId,
      table.escalationStage
    ),
    statusIdx: index('coaching_sessions_status_idx').on(table.status),
    ctIdx: index('coaching_sessions_ct_idx').on(table.assignedCtClerkId),
    managerIdx: index('coaching_sessions_manager_idx').on(table.managerName),
  })
)

// ============================================================
// INFERRED TYPES
// ============================================================

export type AppUser = typeof appUsers.$inferSelect
export type NewAppUser = typeof appUsers.$inferInsert
export type Invite = typeof invites.$inferSelect
export type NewInvite = typeof invites.$inferInsert
export type Warehouse = typeof warehouses.$inferSelect
export type NewWarehouse = typeof warehouses.$inferInsert
export type UserPreference = typeof userPreferences.$inferSelect
export type NewUserPreference = typeof userPreferences.$inferInsert
export type ShiftPlan = typeof shiftPlans.$inferSelect
export type NewShiftPlan = typeof shiftPlans.$inferInsert
export type ShiftPlanSubmission = typeof shiftPlanSubmissions.$inferSelect
export type NewShiftPlanSubmission = typeof shiftPlanSubmissions.$inferInsert
export type FlexPlanEntry = typeof flexPlanEntries.$inferSelect
export type NewFlexPlanEntry = typeof flexPlanEntries.$inferInsert
export type DepartmentRoster = typeof departmentRosters.$inferSelect
export type NewDepartmentRoster = typeof departmentRosters.$inferInsert
export type PerformanceWeek = typeof performanceWeeks.$inferSelect
export type NewPerformanceWeek = typeof performanceWeeks.$inferInsert
export type PerformanceDay = typeof performanceDays.$inferSelect
export type NewPerformanceDay = typeof performanceDays.$inferInsert
export type ChecklistTemplate = typeof checklistTemplates.$inferSelect
export type NewChecklistTemplate = typeof checklistTemplates.$inferInsert
export type CoachingRosterEntry = typeof coachingRoster.$inferSelect
export type NewCoachingRosterEntry = typeof coachingRoster.$inferInsert
export type CoachingApproval = typeof coachingApprovals.$inferSelect
export type NewCoachingApproval = typeof coachingApprovals.$inferInsert
export type CoachingSession = typeof coachingSessions.$inferSelect
export type NewCoachingSession = typeof coachingSessions.$inferInsert
export type EscalationStage = typeof escalationStageEnum.enumValues[number]
export type CardStatus = typeof cardStatusEnum.enumValues[number]
export type ApprovalType = typeof approvalTypeEnum.enumValues[number]
export type ApprovalStatus = typeof approvalStatusEnum.enumValues[number]
export type CoachingStatus = typeof coachingStatusEnum.enumValues[number]
