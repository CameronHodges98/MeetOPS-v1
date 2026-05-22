import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

// Neon's serverless driver uses HTTP instead of a persistent TCP connection.
// This is required for Vercel's serverless functions which don't maintain
// long-lived connections. Each function invocation gets a fresh HTTP request
// to Neon, which handles pooling on its end.
//
// The check is deferred to request time (not module load time) so that
// Next.js build-phase static analysis can import this module without a
// DATABASE_URL present in the build environment.

function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local and fill in your Neon connection string.'
    )
  }
  const sql = neon(process.env.DATABASE_URL)
  return drizzle(sql, {
    schema,
    logger: process.env.NODE_ENV === 'development',
  })
}

// Cached per cold start — module is re-evaluated on each serverless cold start anyway.
let _db: ReturnType<typeof getDb> | undefined

export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop) {
    if (!_db) _db = getDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (_db as any)[prop]
  },
})

export type DB = typeof db
