import {
  pgTable,
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
// WAREHOUSES
// One row per physical facility. Mesa is the active location.
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
// ============================================================

export const userPreferences = pgTable('user_preferences', {
  id: serial('id').primaryKey(),
  clerkUserId: varchar('clerk_user_id', { length: 100 }).notNull().unique(),
  defaultWarehouseId: integer('default_warehouse_id').references(() => warehouses.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ============================================================
// USER PROFILES
// Extends Clerk users with role (manager, ops, gm).
// ============================================================

export const userProfiles = pgTable(
  'user_profiles',
  {
    id: serial('id').primaryKey(),
    clerkId: varchar('clerk_id', { length: 100 }).notNull().unique(),
    role: varchar('role', { length: 50 }),
    displayName: varchar('display_name', { length: 100 }),
    email: varchar('email', { length: 200 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    clerkIdIdx: uniqueIndex('user_profiles_clerk_id_idx').on(table.clerkId),
  })
)

// ============================================================
// SHIFT PLANS
// One row per date/location — the container for a day's plan.
// publishedAt non-null = plan is locked; submissions read-only.
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
// One row per department per day. Supervisors fill in callouts,
// OT, and exempt/designated employees before the plan is published.
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
// Labor flex moves the Ops Manager confirms for a given quarter.
// quarter: 1–4 mapping to the four shift periods.
// ============================================================

export const flexPlanEntries = pgTable(
  'flex_plan_entries',
  {
    id: serial('id').primaryKey(),
    shiftPlanId: integer('shift_plan_id')
      .notNull()
      .references(() => shiftPlans.id),
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
// Persistent headcount per department per location.
// shiftSchedule stores { weekday: ShiftEntry[], weekend: ShiftEntry[] }.
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

export type Warehouse = typeof warehouses.$inferSelect
export type NewWarehouse = typeof warehouses.$inferInsert
export type UserPreference = typeof userPreferences.$inferSelect
export type NewUserPreference = typeof userPreferences.$inferInsert
export type UserProfile = typeof userProfiles.$inferSelect
export type NewUserProfile = typeof userProfiles.$inferInsert
export type ShiftPlan = typeof shiftPlans.$inferSelect
export type NewShiftPlan = typeof shiftPlans.$inferInsert
export type ShiftPlanSubmission = typeof shiftPlanSubmissions.$inferSelect
export type NewShiftPlanSubmission = typeof shiftPlanSubmissions.$inferInsert
export type FlexPlanEntry = typeof flexPlanEntries.$inferSelect
export type NewFlexPlanEntry = typeof flexPlanEntries.$inferInsert
export type DepartmentRoster = typeof departmentRosters.$inferSelect
export type NewDepartmentRoster = typeof departmentRosters.$inferInsert
