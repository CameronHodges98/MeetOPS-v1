# MeetOPS

Operations management suite for warehouse floor managers. Real-time labor decisions backed by data.

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | Vercel-native, API routes + frontend in one project |
| Language | TypeScript | Type safety across DB schema → API → UI |
| Database | Neon (serverless PostgreSQL) | Scales to zero, HTTP driver works in Vercel serverless |
| ORM | Drizzle | Zero overhead on serverless, types inferred from schema |
| Auth | Clerk | Drop-in auth with role support for future manager/admin split |
| UI | shadcn/ui + Tailwind CSS | Owned components, no library constraints |
| State | TanStack Query (server) + Zustand (client) | Clean separation of concerns |
| Charts | Recharts | Composable, works with React 19 |

## Getting Started

### 1. Clone and install
```bash
git clone <repo>
cd meetops
npm install
```

### 2. Initialize shadcn/ui
```bash
npx shadcn@latest init
# When prompted: TypeScript=yes, style=default, CSS variables=yes, tailwind.config=tailwind.config.ts
```

Then add the components you need:
```bash
npx shadcn@latest add button card badge table input select dialog tooltip tabs
```

### 3. Set up environment variables
```bash
cp .env.example .env.local
# Fill in DATABASE_URL (from Neon dashboard) and Clerk keys
```

### 4. Push database schema to Neon
```bash
npm run db:push
# This creates all tables without generating migration files.
# Use db:generate + db:migrate for production migrations.
```

### 5. Import the UPH standards (first thing to do after DB setup)
The UPH_Scale.csv from example-data/ must be loaded before action log imports work.
Use the CSV uploader in any tool, or run:
```bash
# TODO: Add seed script that pre-loads UPH standards from example-data/
npm run db:seed
```

### 6. Run development server
```bash
npm run dev
# Open http://localhost:3000
```

## Project Structure

```
meetops/
├── app/                    # Next.js App Router
│   ├── (tools)/            # Tool pages (no URL segment)
│   └── api/                # Serverless API routes
├── features/               # Tool-specific logic (self-contained)
├── components/             # Shared UI components
├── lib/
│   ├── db/                 # Drizzle schema + Neon client
│   ├── ingestion/          # CSV and live feed pipelines
│   └── utils/              # Pure utility functions
└── config/                 # App-wide constants and thresholds
```

## Adding a New Tool

Four steps, nothing else changes:

1. `mkdir -p features/new-tool/{components,hooks}` and create `store.ts`, `queries.ts`, `utils.ts`
2. Create `app/(tools)/new-tool/page.tsx`
3. Create `app/api/new-tool/route.ts`
4. Add a link in `components/layout/Navbar.tsx`

## Removing a Tool

1. Delete `features/tool-name/`
2. Delete `app/(tools)/tool-name/`
3. Delete `app/api/tool-name/`
4. Remove the nav link from `components/layout/Navbar.tsx`

No other files are affected.

## Architectural Rules

- **`features/` folders never import from each other.** Cross-tool logic belongs in `lib/`.
- **`lib/` has no React.** Pure TypeScript only. Independently testable.
- **`lib/db/schema.ts` is the single source of truth for types.** Never write manual interfaces that duplicate DB types.
- **Constants go in `config/constants.ts`.** Operational thresholds (PPH flags, cycle time ratios) are business decisions, not code decisions.

## Data Ingestion

Currently in **CSV mode** (`DATA_SOURCE=csv` in .env.local).

Import order matters:
1. `employees` — must exist before any other imports
2. `uph_standards` — must exist before action log processing
3. `action_logs` — the main event data
4. `appointments`, `throughput` — supporting data

**Switching to live feed** (when warehouse API access is granted):
1. Set `DATA_SOURCE=live` in Vercel environment variables
2. Implement `lib/ingestion/live/index.ts` (stubs are documented there)
3. Update `app/api/ingest/live/route.ts`
4. The rest of the app is unchanged.

## Deployment (Vercel)

```bash
vercel --prod
```

Set these environment variables in the Vercel dashboard:
- `DATABASE_URL` — Neon pooled connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATA_SOURCE=csv`
- `NEXT_PUBLIC_DEFAULT_LOCATION=Mesa`
