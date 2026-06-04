import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  integer,
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
// APP USERS
// Every authorized user of the platform. Created when an invite
// is accepted. The source of truth for role-based access control.
// opsManagerClerkId is set for Area Managers only — points to the
// Ops Manager they report to.
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
// One-time sign-up tokens sent by root/GM. Expire after 36 hours.
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
