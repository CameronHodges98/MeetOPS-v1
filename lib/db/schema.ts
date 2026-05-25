import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  jsonb,
  bigint,
  index,
  uniqueIndex,
  AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

// ============================================================
// ENUMS
// Defined as PostgreSQL enums for DB-level constraint enforcement.
// Adding a new value requires a migration — don't add speculatively.
// ============================================================

export const jobTitleEnum = pgEnum('job_title', [
  'Picker',
  'Inventory Processor',
  'Load Out',
  'Put Away',
  'Lot Attendant',
  'Returns Clerk',
  'Material Handler',
  'Area Manager',
  'Safety Coordinator',
])

export const employeeStatusEnum = pgEnum('employee_status', [
  'active',
  'inactive',
  'on_leave',
])

export const logTypeEnum = pgEnum('log_type', [
  'appointment',
  'item',
  'container',
])

export const itemSizeEnum = pgEnum('item_size', [
  'small',
  'medium',
  'large',
  'x-large',
])

export const dataSourceEnum = pgEnum('data_source', [
  'csv',   // Manually uploaded CSV file
  'live',  // Live warehouse system API feed (future)
])

export const coachingStatusEnum = pgEnum('coaching_status', [
  'pending',       // Assigned but not started
  'in_progress',   // Trainer actively working with employee
  'completed',     // Training completed, awaiting manager review
  'acknowledged',  // Manager reviewed and employee signed off
])

export const assignmentStatusEnum = pgEnum('assignment_status', [
  'assigned',        // Manager assigned, CT notified
  'in_progress',     // CT has started the template form
  'pending_review',  // CT submitted, awaiting manager completion
  'complete',        // Manager marked complete
])

export const trainerScheduleEnum = pgEnum('trainer_schedule', [
  'weekday',  // Mon–Thu only
  'weekend',  // Fri–Sun only
  'both',     // Any day
])

export const trainingStatusEnum = pgEnum('training_status', [
  'active',
  'completed',
  'cancelled',
])

export const programTypeEnum = pgEnum('program_type', [
  'RC Sortable',
  'RC Nonsort',
  'FC Sortable',
  'FC Nonsort',
  'Non-Sort RC No',
  'XL',
])

// ============================================================
// EMPLOYEES
// Core identity table. Paylocity ID is the stable external key
// used for joining against HR exports and future live feeds.
// supervisorId is self-referencing — each employee points to
// their direct supervisor, who is also an employee record.
// The full 4-level chain is traversed in code or via recursive
// CTE when needed.
// ============================================================

export const employees = pgTable(
  'employees',
  {
    id: serial('id').primaryKey(),
    paylocityId: varchar('paylocity_id', { length: 20 }).notNull().unique(),
    // cargoId is the warehouse system's internal ID — different from Paylocity
    cargoId: integer('cargo_id'),
    name: varchar('name', { length: 100 }).notNull(),
    jobTitle: jobTitleEnum('job_title').notNull(),
    status: employeeStatusEnum('status').notNull().default('active'),
    location: varchar('location', { length: 50 }).notNull().default('Mesa'),
    // hireDate is null until Paylocity API is connected — used for coaching context
    hireDate: date('hire_date'),
    // Self-referencing FK to direct supervisor
    supervisorId: integer('supervisor_id').references((): AnyPgColumn => employees.id),
    // isTrainer flags employees certified to run coaching sessions
    isTrainer: boolean('is_trainer').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    paylocityIdx: uniqueIndex('employees_paylocity_id_idx').on(table.paylocityId),
    supervisorIdx: index('employees_supervisor_id_idx').on(table.supervisorId),
    locationIdx: index('employees_location_idx').on(table.location),
  })
)

// ============================================================
// ACTION LOGS
// The highest-volume table. Every scan, pick, putaway, and
// process event lands here. With 80k+ rows per day and weeks
// of history, this table needs strong indexing on the columns
// most frequently filtered: employee, date, action.
//
// source column distinguishes CSV-imported records from future
// live feed records — critical for auditing and debugging
// ingestion issues without touching the query layer.
// ============================================================

export const actionLogs = pgTable(
  'action_logs',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id')
      .notNull()
      .references(() => employees.id),
    // createdAt is the warehouse system's original event timestamp (ISO 8601 UTC)
    // This is the field used for all cycle time calculations
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    date: date('date').notNull(),
    hour: varchar('hour', { length: 10 }).notNull(), // e.g. "9 AM"
    location: varchar('location', { length: 50 }).notNull(),
    logType: logTypeEnum('log_type').notNull(),
    // itemId can be null for appointment-level actions (Checked In, Appointment Created, etc.)
    itemId: bigint('item_id', { mode: 'number' }),
    action: varchar('action', { length: 100 }).notNull(),
    program: varchar('program', { length: 100 }),
    programType: programTypeEnum('program_type'),
    size: itemSizeEnum('size'),
    // source tracks how this record entered the system
    source: dataSourceEnum('source').notNull().default('csv'),
    // ingestedAt is when WE received it — distinct from createdAt (the warehouse event time)
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Composite index on the most common query pattern: employee within a time window
    employeeDateIdx: index('action_logs_employee_date_idx').on(
      table.employeeId,
      table.date
    ),
    // For filtering by action type across all employees (UPH aggregations)
    actionDateIdx: index('action_logs_action_date_idx').on(table.action, table.date),
    // For cycle time queries: sort all actions for one employee chronologically
    employeeCreatedAtIdx: index('action_logs_employee_created_at_idx').on(
      table.employeeId,
      table.createdAt
    ),
    dateIdx: index('action_logs_date_idx').on(table.date),
  })
)

// ============================================================
// UPH STANDARDS
// The benchmark table derived from UPH_Scale.csv.
// This is the yardstick everything else is measured against.
// Stored in DB (not hardcoded) so standards can be updated
// by operations management without a code deploy.
// ============================================================

export const uphStandards = pgTable(
  'uph_standards',
  {
    id: serial('id').primaryKey(),
    action: varchar('action', { length: 100 }).notNull(),
    location: varchar('location', { length: 50 }).notNull(),
    // itemSize and programProfile are nullable — some actions don't vary by these dimensions
    itemSize: itemSizeEnum('item_size'),
    programProfile: varchar('program_profile', { length: 50 }),
    // Stored as numeric for precision (no float rounding issues in financial/point math)
    secPerAction: numeric('sec_per_action', { precision: 8, scale: 2 }).notNull(),
    pointsPerAction: numeric('points_per_action', { precision: 8, scale: 2 }).notNull(),
    uph: integer('uph').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // The join key: match action + size + program to get the standard for a given log row
    actionSizeProgramIdx: uniqueIndex('uph_standards_action_size_program_idx').on(
      table.action,
      table.itemSize,
      table.programProfile
    ),
  })
)

// ============================================================
// SHIFTS
// Scheduled and actual shift records per employee per day.
// Initially populated from CSV exports of scheduling data.
// Future: direct Paylocity API feed populates this automatically.
// scheduledStart/End are used as the denominator for PPH math —
// more accurate than inferring shift hours from action timestamps.
// ============================================================

export const shifts = pgTable(
  'shifts',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id')
      .notNull()
      .references(() => employees.id),
    date: date('date').notNull(),
    scheduledStart: timestamp('scheduled_start', { withTimezone: true }),
    scheduledEnd: timestamp('scheduled_end', { withTimezone: true }),
    // actualStart/End come from clock-in/out — null until Paylocity feed connected
    actualStart: timestamp('actual_start', { withTimezone: true }),
    actualEnd: timestamp('actual_end', { withTimezone: true }),
    department: varchar('department', { length: 100 }),
    absenceCode: varchar('absence_code', { length: 20 }), // e.g. "CA" = callout, "PTO"
    isOt: boolean('is_ot').notNull().default(false),
    source: dataSourceEnum('source').notNull().default('csv'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    employeeDateIdx: uniqueIndex('shifts_employee_date_idx').on(
      table.employeeId,
      table.date
    ),
  })
)

// ============================================================
// CYCLE TIME FLAGS
// Computed and stored — not recalculated on every query.
// When a new batch of action_logs is ingested, the cycle time
// computation runs and writes flagged events here.
// ratio = actualSeconds / standardSeconds
// ratio > 2.0 is the default flag threshold (configurable in constants.ts)
// ============================================================

export const cycleTimeFlags = pgTable(
  'cycle_time_flags',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id')
      .notNull()
      .references(() => employees.id),
    date: date('date').notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    // The two action_logs rows that produced this flag
    precedingActionLogId: integer('preceding_action_log_id').references(
      () => actionLogs.id
    ),
    followingActionLogId: integer('following_action_log_id').references(
      () => actionLogs.id
    ),
    actualSeconds: numeric('actual_seconds', { precision: 10, scale: 3 }).notNull(),
    standardSeconds: numeric('standard_seconds', { precision: 10, scale: 3 }).notNull(),
    ratio: numeric('ratio', { precision: 8, scale: 4 }).notNull(),
    program: varchar('program', { length: 100 }),
    size: itemSizeEnum('size'),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    employeeDateIdx: index('cycle_flags_employee_date_idx').on(
      table.employeeId,
      table.date
    ),
    ratioIdx: index('cycle_flags_ratio_idx').on(table.ratio),
  })
)

// ============================================================
// COACHING SESSIONS
// Tracks the full lifecycle of a coaching event:
// manager identifies issue → assigns trainer → trainer completes
// form → manager reviews → employee acknowledges.
// formData is JSONB because the coaching form fields may evolve
// without requiring a migration every time a field is added.
// ============================================================

export const coachingSessions = pgTable(
  'coaching_sessions',
  {
    id: serial('id').primaryKey(),
    // The employee receiving coaching
    employeeId: integer('employee_id')
      .notNull()
      .references(() => employees.id),
    // The manager who initiated the coaching
    managerId: integer('manager_id')
      .notNull()
      .references(() => employees.id),
    // The trainer assigned — null if manager is conducting directly
    trainerId: integer('trainer_id').references(() => employees.id),
    coachingDate: date('coaching_date').notNull(),
    status: coachingStatusEnum('status').notNull().default('pending'),
    // Trigger context: what data point prompted this coaching
    triggerType: varchar('trigger_type', { length: 50 }), // e.g. "low_pph", "cycle_time_flag"
    triggerValue: numeric('trigger_value', { precision: 8, scale: 2 }), // e.g. the PPH that triggered it
    triggerStandard: numeric('trigger_standard', { precision: 8, scale: 2 }), // the standard at trigger time
    // Flexible form data — structure defined in lib/types/coaching.ts
    formData: jsonb('form_data'),
    managerNotes: varchar('manager_notes', { length: 2000 }),
    employeeAcknowledgedAt: timestamp('employee_acknowledged_at', {
      withTimezone: true,
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    employeeIdx: index('coaching_employee_idx').on(table.employeeId),
    statusIdx: index('coaching_status_idx').on(table.status),
    dateIdx: index('coaching_date_idx').on(table.coachingDate),
  })
)

// ============================================================
// TRAINING ASSIGNMENTS
// Maps trainers to trainees for an active coaching period.
// A trainer can have multiple trainees; a trainee can only have
// one active trainer at a time (enforced in application logic).
// ============================================================

export const trainingAssignments = pgTable(
  'training_assignments',
  {
    id: serial('id').primaryKey(),
    traineeId: integer('trainee_id')
      .notNull()
      .references(() => employees.id),
    trainerId: integer('trainer_id')
      .notNull()
      .references(() => employees.id),
    // The manager who made the assignment
    assignedById: integer('assigned_by_id')
      .notNull()
      .references(() => employees.id),
    coachingSessionId: integer('coaching_session_id').references(
      () => coachingSessions.id
    ),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    status: trainingStatusEnum('status').notNull().default('active'),
    // Skills being trained — array of action names or competency codes
    skills: varchar('skills', { length: 100 }).array(),
    trainerNotes: varchar('trainer_notes', { length: 2000 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    traineeIdx: index('training_trainee_idx').on(table.traineeId),
    trainerIdx: index('training_trainer_idx').on(table.trainerId),
    statusIdx: index('training_status_idx').on(table.status),
  })
)

// ============================================================
// APPOINTMENTS
// Inbound appointment volume by hour.
// Drives staffing demand calculations in the shift planner.
// ============================================================

export const appointments = pgTable(
  'appointments',
  {
    id: serial('id').primaryKey(),
    location: varchar('location', { length: 50 }).notNull(),
    appointmentDate: date('appointment_date').notNull(),
    hour: integer('hour').notNull(), // 0–23
    appointmentCount: integer('appointment_count').notNull(),
    source: dataSourceEnum('source').notNull().default('csv'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    locationDateHourIdx: uniqueIndex('appointments_location_date_hour_idx').on(
      table.location,
      table.appointmentDate,
      table.hour
    ),
  })
)

// ============================================================
// PROCESSING THROUGHPUT
// Daily items processed per program.
// Used for volume trend analysis and capacity planning.
// ============================================================

export const processingThroughput = pgTable(
  'processing_throughput',
  {
    id: serial('id').primaryKey(),
    programName: varchar('program_name', { length: 100 }).notNull(),
    processedDate: date('processed_date').notNull(),
    itemsProcessed: integer('items_processed').notNull().default(0),
    source: dataSourceEnum('source').notNull().default('csv'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    programDateIdx: uniqueIndex('throughput_program_date_idx').on(
      table.programName,
      table.processedDate
    ),
  })
)

// ============================================================
// RELATIONS
// Drizzle relations enable type-safe joins in queries.
// ============================================================

export const employeesRelations = relations(employees, ({ one, many }) => ({
  supervisor: one(employees, {
    fields: [employees.supervisorId],
    references: [employees.id],
    relationName: 'supervisor',
  }),
  directReports: many(employees, { relationName: 'supervisor' }),
  actionLogs: many(actionLogs),
  shifts: many(shifts),
  cycleTimeFlags: many(cycleTimeFlags),
  coachingSessionsAsEmployee: many(coachingSessions, {
    relationName: 'coached_employee',
  }),
  coachingSessionsAsManager: many(coachingSessions, {
    relationName: 'managing_coach',
  }),
  trainingAssignmentsAsTrainee: many(trainingAssignments, {
    relationName: 'trainee',
  }),
  trainingAssignmentsAsTrainer: many(trainingAssignments, {
    relationName: 'trainer',
  }),
}))

export const actionLogsRelations = relations(actionLogs, ({ one }) => ({
  employee: one(employees, {
    fields: [actionLogs.employeeId],
    references: [employees.id],
  }),
}))

export const shiftsRelations = relations(shifts, ({ one }) => ({
  employee: one(employees, {
    fields: [shifts.employeeId],
    references: [employees.id],
  }),
}))

export const cycleTimeFlagsRelations = relations(cycleTimeFlags, ({ one }) => ({
  employee: one(employees, {
    fields: [cycleTimeFlags.employeeId],
    references: [employees.id],
  }),
}))

export const coachingSessionsRelations = relations(
  coachingSessions,
  ({ one }) => ({
    employee: one(employees, {
      fields: [coachingSessions.employeeId],
      references: [employees.id],
      relationName: 'coached_employee',
    }),
    manager: one(employees, {
      fields: [coachingSessions.managerId],
      references: [employees.id],
      relationName: 'managing_coach',
    }),
    trainer: one(employees, {
      fields: [coachingSessions.trainerId],
      references: [employees.id],
    }),
    trainingAssignment: one(trainingAssignments, {
      fields: [coachingSessions.id],
      references: [trainingAssignments.coachingSessionId],
    }),
  })
)

export const trainingAssignmentsRelations = relations(
  trainingAssignments,
  ({ one }) => ({
    trainee: one(employees, {
      fields: [trainingAssignments.traineeId],
      references: [employees.id],
      relationName: 'trainee',
    }),
    trainer: one(employees, {
      fields: [trainingAssignments.trainerId],
      references: [employees.id],
      relationName: 'trainer',
    }),
    assignedBy: one(employees, {
      fields: [trainingAssignments.assignedById],
      references: [employees.id],
    }),
    coachingSession: one(coachingSessions, {
      fields: [trainingAssignments.coachingSessionId],
      references: [coachingSessions.id],
    }),
  })
)

// ============================================================
// WAREHOUSES
// One row per physical facility. name maps 1:1 to the location
// varchar already stored in employees, action_logs, shift_plans.
// No migration needed for existing data — Mesa is auto-seeded.
// ============================================================

export const warehouses = pgTable('warehouses', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ============================================================
// USER PREFERENCES
// Stores each Clerk user's default warehouse selection.
// clerkUserId is the stable key from Clerk auth.
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
// One row per date/location — the container for a day's plan.
// All department submissions and flex entries hang off this record.
// publishedAt being non-null means the Ops Manager has locked and
// distributed the plan; submissions become read-only after that.
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
// One row per department per day. Area Managers fill in callouts,
// OT available, and exempt employees before the Ops Manager
// publishes the plan. exemptEntries is a JSONB array of
// { count: number, reason: string } objects.
// ============================================================

export const shiftPlanSubmissions = pgTable(
  'shift_plan_submissions',
  {
    id: serial('id').primaryKey(),
    shiftPlanId: integer('shift_plan_id')
      .notNull()
      .references(() => shiftPlans.id),
    department: varchar('department', { length: 100 }).notNull(),
    calloutCount: integer('callout_count').notNull().default(0),
    otCount: integer('ot_count').notNull().default(0),
    // [{ count: number, reason: string }]
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
// Each row is one labor flex move the Ops Manager creates after
// reviewing all department submissions. quarter maps to the 4
// staffing periods: 1=8AM, 2=11AM, 3=1PM, 4=3PM.
// ============================================================

export const flexPlanEntries = pgTable(
  'flex_plan_entries',
  {
    id: serial('id').primaryKey(),
    shiftPlanId: integer('shift_plan_id')
      .notNull()
      .references(() => shiftPlans.id),
    quarter: integer('quarter').notNull(), // 1–4
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
// HOURLY ACTION TOTALS
// Pre-aggregated action counts by date/hour/location/department/action.
// Imported from the weekly actions export CSV (aggregated — no employee names).
// Used by the shift plan historical query instead of the raw action_logs table
// to avoid slow joins and employee-level granularity we don't need for predictions.
// ============================================================

export const hourlyActionTotals = pgTable(
  'hourly_action_totals',
  {
    id: serial('id').primaryKey(),
    date: date('date').notNull(),
    hour: integer('hour').notNull(), // 0–23
    location: varchar('location', { length: 50 }).notNull(),
    department: varchar('department', { length: 100 }).notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    totalCount: integer('total_count').notNull(),
    source: dataSourceEnum('source').notNull().default('csv'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    dateHourDeptActionIdx: uniqueIndex('hat_date_hour_dept_action_idx').on(
      table.date, table.hour, table.location, table.department, table.action
    ),
    dateLocationIdx: index('hat_date_location_idx').on(table.date, table.location),
  })
)

// ============================================================
// INFERRED TYPES
// These are the TypeScript types for every table, automatically
// derived from the schema above. Import from here — never write
// manual interfaces that could drift out of sync with the DB.
// ============================================================

export type Employee = typeof employees.$inferSelect
export type NewEmployee = typeof employees.$inferInsert
export type ActionLog = typeof actionLogs.$inferSelect
export type NewActionLog = typeof actionLogs.$inferInsert
export type UphStandard = typeof uphStandards.$inferSelect
export type NewUphStandard = typeof uphStandards.$inferInsert
export type Shift = typeof shifts.$inferSelect
export type NewShift = typeof shifts.$inferInsert
export type CycleTimeFlag = typeof cycleTimeFlags.$inferSelect
export type NewCycleTimeFlag = typeof cycleTimeFlags.$inferInsert
export type CoachingSession = typeof coachingSessions.$inferSelect
export type NewCoachingSession = typeof coachingSessions.$inferInsert
export type TrainingAssignment = typeof trainingAssignments.$inferSelect
export type NewTrainingAssignment = typeof trainingAssignments.$inferInsert
export type Appointment = typeof appointments.$inferSelect
export type NewAppointment = typeof appointments.$inferInsert
export type ProcessingThroughput = typeof processingThroughput.$inferSelect
export type NewProcessingThroughput = typeof processingThroughput.$inferInsert
// ============================================================
// DEPARTMENT ROSTERS
// Persistent scheduled headcount per department per location.
// Updated only on new hires or terminations — not tied to any
// individual shift plan. One row per department+location pair.
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
// USER PROFILES
// Extends Clerk users with role and trainer schedule.
// clerkId matches Clerk's userId (e.g., "user_2abc...").
// CTs (Certified Trainers) may not be in the employees table —
// they authenticate via invite link and bypass domain check.
// ============================================================

export const userProfiles = pgTable(
  'user_profiles',
  {
    id: serial('id').primaryKey(),
    clerkId: varchar('clerk_id', { length: 100 }).notNull().unique(),
    role: varchar('role', { length: 50 }),          // 'ct', 'manager', 'ops', 'gm'
    displayName: varchar('display_name', { length: 100 }),
    email: varchar('email', { length: 200 }),        // personal email for CT invites
    trainerSchedule: trainerScheduleEnum('trainer_schedule'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    clerkIdIdx: uniqueIndex('user_profiles_clerk_id_idx').on(table.clerkId),
  })
)

// ============================================================
// COACHING INVITES
// One-time invite tokens for external CTs who don't have an
// @nellisauction.com email. The link lets them bypass the
// domain check and creates a Clerk account with role=ct set
// in publicMetadata automatically.
// ============================================================

export const coachingInvites = pgTable(
  'coaching_invites',
  {
    id: serial('id').primaryKey(),
    token: varchar('token', { length: 100 }).notNull().unique(),
    createdByClerkId: varchar('created_by_clerk_id', { length: 100 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    usedByClerkId: varchar('used_by_clerk_id', { length: 100 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tokenIdx: uniqueIndex('coaching_invites_token_idx').on(table.token),
  })
)

// ============================================================
// COACHING UPLOADS
// One row per weekly CSV upload. Tracks who uploaded, the file
// name, and the date range the CSV covers. candidateCount is
// set after parsing completes so the UI can show upload history.
// ============================================================

export const coachingUploads = pgTable(
  'coaching_uploads',
  {
    id: serial('id').primaryKey(),
    uploadedByClerkId: varchar('uploaded_by_clerk_id', { length: 100 }).notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    weekStartDate: date('week_start_date').notNull(),
    weekEndDate: date('week_end_date').notNull(),
    candidateCount: integer('candidate_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    weekIdx: index('coaching_uploads_week_idx').on(table.weekStartDate),
  })
)

// ============================================================
// COACHING CANDIDATES
// One row per employee who appeared in a coaching upload and
// met the threshold (avgPph < 100 OR avgGapPct > 10%).
// isExempt lets managers exclude employees from the workflow
// without deleting them (e.g., temporary role change).
// assignmentId is set once a coaching assignment is created.
// ============================================================

export const coachingCandidates = pgTable(
  'coaching_candidates',
  {
    id: serial('id').primaryKey(),
    uploadId: integer('upload_id').notNull().references(() => coachingUploads.id, { onDelete: 'cascade' }),
    managerName: varchar('manager_name', { length: 100 }).notNull(),
    employeeName: varchar('employee_name', { length: 100 }).notNull(),
    jobTitle: varchar('job_title', { length: 100 }),
    avgPph: numeric('avg_pph', { precision: 8, scale: 2 }),
    avgGapPct: numeric('avg_gap_pct', { precision: 8, scale: 2 }),
    avgDirectPct: numeric('avg_direct_pct', { precision: 8, scale: 2 }),
    avgIndirectPct: numeric('avg_indirect_pct', { precision: 8, scale: 2 }),
    avgAdminPct: numeric('avg_admin_pct', { precision: 8, scale: 2 }),
    avgHours: numeric('avg_hours', { precision: 6, scale: 2 }),
    daysInSample: integer('days_in_sample').notNull().default(1),
    isExempt: boolean('is_exempt').notNull().default(false),
    exemptedByClerkId: varchar('exempted_by_clerk_id', { length: 100 }),
    exemptedAt: timestamp('exempted_at', { withTimezone: true }),
    assignmentId: integer('assignment_id'),   // FK set after insert to avoid circular dep
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    uploadIdx: index('coaching_candidates_upload_idx').on(table.uploadId),
    managerIdx: index('coaching_candidates_manager_idx').on(table.managerName),
  })
)

// ============================================================
// COACHING TEMPLATES
// One template per job category (Processing, Returns, Picking,
// Put Away, Customer Service). Managers can create, edit, and
// delete templates. objectives is a JSONB array of
// { id: string, text: string } objects.
// ============================================================

export const coachingTemplates = pgTable(
  'coaching_templates',
  {
    id: serial('id').primaryKey(),
    department: varchar('department', { length: 100 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    // [{ id: string, text: string }]
    objectives: jsonb('objectives').notNull().default('[]'),
    isActive: boolean('is_active').notNull().default(true),
    updatedByClerkId: varchar('updated_by_clerk_id', { length: 100 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    departmentIdx: index('coaching_templates_dept_idx').on(table.department),
  })
)

// ============================================================
// COACHING ASSIGNMENTS
// The active coaching workflow record. Created when a manager
// assigns a CT to a candidate. status flows:
//   assigned → in_progress → pending_review → complete
// objectiveResults is a JSONB array of:
//   { objectiveId: string, result: 'understands' | 'bottleneck', comment?: string }
// dueCtAt = createdAt + 1 day; dueManagerAt = ctSubmittedAt + 1 day
// ============================================================

export const coachingAssignments = pgTable(
  'coaching_assignments',
  {
    id: serial('id').primaryKey(),
    candidateId: integer('candidate_id').notNull().references(() => coachingCandidates.id),
    templateId: integer('template_id').notNull().references(() => coachingTemplates.id),
    assignedByClerkId: varchar('assigned_by_clerk_id', { length: 100 }).notNull(),
    trainerClerkId: varchar('trainer_clerk_id', { length: 100 }).notNull(),
    managerNotes: varchar('manager_notes', { length: 2000 }),
    status: assignmentStatusEnum('status').notNull().default('assigned'),
    // [{ objectiveId, result: 'understands' | 'bottleneck', comment?: string }]
    objectiveResults: jsonb('objective_results'),
    ctSummaryNotes: varchar('ct_summary_notes', { length: 2000 }),
    ctStartedAt: timestamp('ct_started_at', { withTimezone: true }),
    ctSubmittedAt: timestamp('ct_submitted_at', { withTimezone: true }),
    dueCtAt: timestamp('due_ct_at', { withTimezone: true }),
    dueManagerAt: timestamp('due_manager_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    // Audit trail: if this assignment was reassigned, points to the original
    reassignedFromId: integer('reassigned_from_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    candidateIdx: index('coaching_assignments_candidate_idx').on(table.candidateId),
    trainerIdx: index('coaching_assignments_trainer_idx').on(table.trainerClerkId),
    statusIdx: index('coaching_assignments_status_idx').on(table.status),
  })
)

export type ShiftPlan = typeof shiftPlans.$inferSelect
export type NewShiftPlan = typeof shiftPlans.$inferInsert
export type ShiftPlanSubmission = typeof shiftPlanSubmissions.$inferSelect
export type NewShiftPlanSubmission = typeof shiftPlanSubmissions.$inferInsert
export type FlexPlanEntry = typeof flexPlanEntries.$inferSelect
export type NewFlexPlanEntry = typeof flexPlanEntries.$inferInsert
export type DepartmentRoster = typeof departmentRosters.$inferSelect
export type NewDepartmentRoster = typeof departmentRosters.$inferInsert
export type Warehouse = typeof warehouses.$inferSelect
export type NewWarehouse = typeof warehouses.$inferInsert
export type UserPreference = typeof userPreferences.$inferSelect
export type NewUserPreference = typeof userPreferences.$inferInsert
export type HourlyActionTotal = typeof hourlyActionTotals.$inferSelect
export type NewHourlyActionTotal = typeof hourlyActionTotals.$inferInsert
export type UserProfile = typeof userProfiles.$inferSelect
export type NewUserProfile = typeof userProfiles.$inferInsert
export type CoachingInvite = typeof coachingInvites.$inferSelect
export type NewCoachingInvite = typeof coachingInvites.$inferInsert
export type CoachingUpload = typeof coachingUploads.$inferSelect
export type NewCoachingUpload = typeof coachingUploads.$inferInsert
export type CoachingCandidate = typeof coachingCandidates.$inferSelect
export type NewCoachingCandidate = typeof coachingCandidates.$inferInsert
export type CoachingTemplate = typeof coachingTemplates.$inferSelect
export type NewCoachingTemplate = typeof coachingTemplates.$inferInsert
export type CoachingAssignment = typeof coachingAssignments.$inferSelect
export type NewCoachingAssignment = typeof coachingAssignments.$inferInsert
