# MeetOPS — Claude Code Project Brief

You are picking up an in-progress project from a planning and scaffolding session. Everything below is ground truth. Do not re-derive architecture from the file structure — read this document first, then the files it references.

---

## What This Project Is

MeetOPS is an operations management web suite for warehouse floor managers at a returns-processing/liquidation facility (Mesa, AZ location). Managers use it in real time to make labor decisions, track productivity, identify bottlenecks, and run structured coaching programs.

It is **not** a reporting tool that managers check once a day. It is a **live decision-support tool** used during active shifts. Speed and clarity of information take priority over visual complexity.

---

## Tech Stack — Do Not Deviate

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 15 App Router | Vercel deployment target |
| Language | TypeScript (strict) | No `any` except where schema inference forces it |
| Database | Neon (serverless PostgreSQL) | HTTP driver — no TCP connections |
| ORM | Drizzle ORM | Schema in `lib/db/schema.ts` only |
| Auth | Clerk | All routes protected via `middleware.ts` |
| UI Components | shadcn/ui + Tailwind CSS | Run `npx shadcn@latest add <component>` when needed |
| Server State | TanStack Query v5 | All API data fetching |
| Client State | Zustand v5 | UI-only state (filters, selections, date pickers) |
| Charts | Recharts | Already in package.json |
| Date Math | date-fns v4 | Already in `lib/utils/dateUtils.ts` |
| CSV Parsing | PapaParse | Used in ingestion layer only |

---

## What Is Already Built (Do Not Rebuild)

### Infrastructure
- `lib/db/schema.ts` — Full Drizzle schema with all 8 tables, enums, relations, and inferred TypeScript types. **This is the source of truth for all types. Never write manual interfaces that duplicate these.**
- `lib/db/index.ts` — Neon + Drizzle client singleton
- `middleware.ts` — Clerk auth protecting all routes
- `app/layout.tsx` — Root layout with ClerkProvider
- `config/constants.ts` — All operational thresholds (PPH flags, cycle time ratios, etc.)

### Utilities (in `lib/utils/`)
- `dateUtils.ts` — Timestamp parsing, cycle time delta math, hour label conversion, duration formatting
- `uphCalculator.ts` — Points math, PPH calculation, gap %, performance status, coaching trigger logic
- `formatters.ts` — Display formatting + `STATUS_DISPLAY` map for badge colors
- `cn.ts` — Tailwind class merging utility

### Ingestion Layer
- `lib/ingestion/types.ts` — Shared ingestion contracts (`IngestionResult`, `ParsedActionLog`, etc.)
- `lib/ingestion/csv/index.ts` — Main CSV orchestrator with batch insert logic
- `lib/ingestion/csv/parsers/actionLogs.ts` — Parses Cycle_Time_Example.csv row format
- `lib/ingestion/csv/parsers/uphStandards.ts` — Parses UPH_Scale.csv row format
- `lib/ingestion/live/index.ts` — Stubbed live feed (DO NOT implement until told to)

### API Routes (stubbed, need query logic filled in)
- `app/api/ingest/csv/route.ts` — File upload + ingestion trigger (complete)
- `app/api/employees/route.ts` — GET employees with filters
- `app/api/uph/route.ts` — PPH aggregation query (raw SQL, functional)
- `app/api/cycle-time/route.ts` — Returns flagged cycle time events
- `app/api/coaching/route.ts` — GET + POST coaching sessions

### Shared Components
- `components/layout/Navbar.tsx` — Top nav linking all tools, Clerk UserButton
- `components/layout/PageHeader.tsx` — Tool title + optional actions slot
- `components/shared/MetricCard.tsx` — KPI card with status badge (green/amber/red)
- `components/shared/CSVUploader.tsx` — Drag-drop CSV upload → calls `/api/ingest/csv`

### Feature Scaffolds (store + query stubs only, no UI)
- `features/shift-plan/` — store.ts, queries.ts, utils.ts
- `features/uph-tracker/` — store.ts, queries.ts (has real useUphData hook), utils.ts
- `features/cycle-time/` — store.ts, queries.ts, utils.ts
- `features/coaching/` — store.ts, queries.ts, utils.ts

### Tool Pages (placeholder only — `<div>coming next</div>`)
- `app/(tools)/shift-plan/page.tsx`
- `app/(tools)/uph-tracker/page.tsx`
- `app/(tools)/cycle-time/page.tsx`
- `app/(tools)/coaching/page.tsx`

---

## What Is NOT Built Yet

The actual tool UIs. Every tool page currently renders a placeholder. This is the remaining work.

---

## The Four Tools — Full Specifications

Work on **one tool at a time**. Do not start the next tool until the current one is confirmed complete.

### Tool 1: UPH Tracker
**Purpose:** Show managers which employees are hitting, approaching, or missing their Points Per Hour standard. Updated per shift/day. Used to identify who needs support before the day is over.

**Key data flows:**
- Query: `action_logs` JOIN `uph_standards` ON action + size + program_type → sum points → divide by hours → PPH
- Hours source: Use `shifts.scheduledStart/End` if available; fall back to inferring from first/last action timestamp per employee per day
- Group by: Individual → Supervisor → Department (3 drill-down levels)
- Gap % = ((standard - actual) / standard) × 100

**UI requirements:**
- Date range picker (default: today)
- Department/job title filter
- Table: Employee | Job Title | Supervisor | Points | Hours | PPH | Gap % | Status badge
- Status badge colors: green (≥95% of standard) / amber (80–95%) / red (<80%)
- MetricCard row at top: Total Points | Facility PPH | On Target count | Needs Attention count
- Clicking an employee row should expand or navigate to their individual action breakdown
- CSV upload panel (file type: `action_logs`) so managers can import the daily export

**Standard PPH reference:** From `uph_standards` table. The "standard" for a given employee's shift is the weighted average UPH across the actions they actually performed, weighted by how many of each they did.

### Tool 2: Shift Plan
**Purpose:** Real-time headcount visibility. How many people are active per department per hour vs. how many are needed based on inbound appointment volume. Allows managers to decide where to flex labor.

**Key data flows:**
- Scheduled headcount: `shifts` table (from CSV import)
- Active headcount proxy: distinct employees with an `action_log` in the last 60 minutes per department
- Demand signal: `appointments` table — appointment count per hour drives how many pickers are needed
- Absence: `shifts.absenceCode` is not null → callout

**UI requirements:**
- Date selector (default: today)
- Heat-map style hourly grid: rows = departments, columns = hours (5AM–8PM), cells = headcount
- Color cells: green = staffed adequately, amber = 1–2 below needed, red = critically understaffed
- Callout list: employees with absenceCode set today
- OT tracker: employees with `isOt = true` on current date
- Labor flex panel: when a department is red, suggest employees from green departments with compatible job titles who could be moved (use `DEPARTMENT_MAP` from constants for compatibility logic)

### Tool 3: Cycle Time Tracker
**Purpose:** Find where individual employees are spending disproportionate time on a single action. A "Scanned for Pick" that takes 26 minutes when standard is 48 seconds is not a slow scan — it's a blocked employee, a scanner issue, or someone who left the floor. These become coaching data points.

**Key data flows:**
- Source: `action_logs` ordered by `(employeeId, createdAt ASC)`
- Algorithm: For each employee, for each action type, calculate `diff(createdAt)` between consecutive same-action rows
- Filter out gaps > 30 minutes (these are breaks/indirect time, not slow cycles — see `CYCLE_TIME_THRESHOLDS.INDIRECT_GAP_MINUTES`)
- Flag: `actualSeconds / standardSeconds > CYCLE_TIME_THRESHOLDS.FLAG_RATIO` (default 2.0×)
- Minimum samples: Only flag if employee has ≥3 samples of that action (prevents single-event noise)
- Store computed flags in `cycle_time_flags` table via a compute endpoint

**UI requirements:**
- Date range picker
- Employee filter
- Minimum ratio slider (default 2.0×)
- Table: Employee | Action | Avg Actual (seconds) | Standard (seconds) | Ratio | Occurrences | Size | Program
- Ratio column color-coded: >3× = red, 2–3× = amber
- "Create Coaching Session" button on each flagged row — pre-fills the coaching form with this data as the trigger
- Summary cards: Total flags today | Most flagged action | Most flagged employee

**Important:** The computation (sorting action logs and calculating deltas) should run server-side in an API route, not in the browser. Results write to `cycle_time_flags` table and are served from there.

### Tool 4: Coaching
**Purpose:** End-to-end workflow for performance coaching. Manager identifies an issue (from UPH or Cycle Time data) → assigns a trainer → trainer completes an observation form → form routes back to manager → manager does coaching report → employee acknowledges.

**Key data flows:**
- `coaching_sessions` table tracks the lifecycle
- `training_assignments` table maps trainer → trainee
- `formData` (JSONB) stores the flexible form fields
- Status transitions: `pending` → `in_progress` → `completed` → `acknowledged`

**UI requirements:**
- Dashboard view: Sessions grouped by status (Kanban-style or tabbed)
- Create session form: Employee selector | Manager (auto from Clerk user) | Trainer selector (only employees with `isTrainer = true`) | Trigger type | Date
- Training form: structured observation fields (completed by trainer) — fields TBD with user
- Manager review view: see completed training form, add manager notes
- Filter by status, employee, supervisor
- Badge showing count of sessions in each status

---

## Database Tables Reference

```
employees           id, paylocityId, cargoId, name, jobTitle, status, location, hireDate, supervisorId, isTrainer
action_logs         id, employeeId, createdAt (UTC timestamp), date, hour, location, logType, itemId, action, program, programType, size, source
uph_standards       id, action, location, itemSize, programProfile, secPerAction, pointsPerAction, uph
shifts              id, employeeId, date, scheduledStart, scheduledEnd, actualStart, actualEnd, department, absenceCode, isOt, source
cycle_time_flags    id, employeeId, date, action, precedingActionLogId, followingActionLogId, actualSeconds, standardSeconds, ratio, program, size
coaching_sessions   id, employeeId, managerId, trainerId, coachingDate, status, triggerType, triggerValue, triggerStandard, formData, managerNotes, employeeAcknowledgedAt
training_assignments id, traineeId, trainerId, assignedById, coachingSessionId, startDate, endDate, status, skills
appointments        id, location, appointmentDate, hour, appointmentCount, source
```

All inferred TypeScript types are exported from `lib/db/schema.ts` as `Employee`, `ActionLog`, `UphStandard`, `Shift`, etc.

---

## Operational Context (Read This to Understand the Domain)

This is a **returns processing and liquidation warehouse**. Inbound inventory arrives in truck appointments. Workers process items through a scan → pick → putaway → load-out workflow.

**Key concepts:**
- **PPH (Points Per Hour):** The core productivity metric. Different actions earn different point values based on difficulty (a 15-minute Variety Pallet earns 25 points; a 8-second presort earns 0.22 points). PPH normalizes effort across task types.
- **Gap %:** How far below the UPH standard an employee is running. 5% gap = close. 20% gap = needs attention today.
- **Programs:** The client/inventory type being processed (PHX6 is the dominant program, ~97% of volume). Program determines the UPH standard tier (RC Sortable, FC Nonsort, XL, etc.)
- **Item size:** Small/Medium/Large/XLarge affects the UPH standard for the same action. Picking an XLarge item earns more points than Small.
- **Appointments:** Inbound truck loads. The hourly appointment count is the demand signal for the shift planner.
- **Flex labor:** When one department is understaffed, workers from another are moved. The tools need to make this decision obvious.
- **Job titles map to departments:** Picker=Picking, Inventory Processor=Processing, Load Out=Load Out, Put Away=Put Away, etc. (full map in `config/constants.ts` → `DEPARTMENT_MAP`)

---

## Architectural Rules — Never Violate These

1. **`features/` folders never import from each other.** If two tools share logic, it goes in `lib/`.
2. **`lib/` has no React.** Pure TypeScript only. If you find yourself importing React in `lib/`, it's in the wrong place.
3. **`lib/db/schema.ts` is the only source of type truth.** Use `typeof schema.employees.$inferSelect` — never duplicate type definitions.
4. **Adding a tool = 4 steps only:** new `features/` folder, new `app/(tools)/` page, new `app/api/` route, one nav link in `Navbar.tsx`. Nothing else changes.
5. **`config/constants.ts` owns all thresholds.** PPH percentages, cycle time ratios, min hours — never hardcode these in components or API routes.

---

## Data Import Order (Critical)

When seeding or testing with the example CSVs:
1. `employees` CSV first — all other tables FK to employees
2. `uph_standards` (UPH_Scale.csv) second — UPH calc joins against this
3. `action_logs` (Cycle_Time_Example.csv) third — resolves employeeId via paylocityId lookup
4. `appointments` and `throughput` — any order after employees

---

## Development Commands

```bash
npm run dev          # Start dev server on localhost:3000
npm run db:push      # Push schema changes to Neon (dev only)
npm run db:generate  # Generate migration files (use for production changes)
npm run db:studio    # Open Drizzle Studio to inspect DB
npm run db:migrate   # Run pending migrations
npm run build        # Verify TypeScript compiles before deploying
```

---

## Environment Variables Required

```
DATABASE_URL                          # Neon pooled connection string
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY     # Clerk public key
CLERK_SECRET_KEY                      # Clerk secret key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
DATA_SOURCE=csv
NEXT_PUBLIC_DEFAULT_LOCATION=Mesa
```

---

## Working Style for This Project

- **One tool at a time.** Complete and confirm before starting the next.
- **Think before writing.** If a component or query feels complex, reason through the data flow first.
- **Components belong in `features/<tool>/components/` if only one tool uses them.** They go in `components/shared/` only if two or more tools use them.
- **Every new API route needs the Clerk auth check** at the top (see existing routes for the pattern).
- **Run `npm run build` before declaring any tool complete.** TypeScript errors caught at build time, not at demo time.
- **When adding a shadcn component**, run `npx shadcn@latest add <component-name>` — do not write Radix UI components from scratch.
