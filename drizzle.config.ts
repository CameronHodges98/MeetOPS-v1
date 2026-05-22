import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  // Single schema file is the source of truth for all table definitions.
  // If schema grows large, split into lib/db/schema/ directory with an index.ts barrel.
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Log every SQL statement generated — useful during initial build
  verbose: true,
  strict: true,
})
