// ============================================================
// Live Feed Ingestion — STUB
//
// This module will replace (or run alongside) CSV ingestion
// once direct warehouse system API access is available.
//
// The interface this module must fulfill is identical to the CSV
// ingestion layer — both write to the same Neon DB tables.
// The query layer (API routes, features/) never changes.
//
// HOW TO ACTIVATE:
// 1. Set DATA_SOURCE=live in .env.local (or Vercel environment)
// 2. Implement the adapter functions below for your specific
//    warehouse system API (REST, WebSocket, or webhook)
// 3. Update app/api/ingest/live/route.ts to call this module
// ============================================================

import type { IngestionResult } from '@/lib/ingestion/types'

/**
 * Polls the warehouse system API for new action events since lastSyncAt.
 * Replace the throw with your actual API client call.
 *
 * Suggested implementation pattern:
 * - GET /warehouse-api/events?since={lastSyncAt.toISOString()}&location=Mesa
 * - Map response shape to ParsedActionLog[]
 * - Batch insert to action_logs table (same as CSV path)
 */
export async function syncActionLogs(lastSyncAt: Date): Promise<IngestionResult> {
  // TODO: Replace with warehouse API client
  throw new Error(
    'Live feed not yet implemented. Set DATA_SOURCE=csv to use CSV upload mode. ' +
    'Implement this function when warehouse API credentials are available.'
  )
}

/**
 * Webhook handler for real-time appointment notifications.
 * The warehouse system calls this endpoint when a new appointment is created or updated.
 */
export async function handleAppointmentWebhook(
  payload: unknown
): Promise<IngestionResult> {
  // TODO: Validate payload shape (use zod schema matching ParsedAppointment)
  // TODO: Insert/upsert to appointments table
  throw new Error('Live feed not yet implemented.')
}

/**
 * Syncs employee roster from Paylocity API.
 * When connected, this replaces manual employee CSV imports.
 *
 * Paylocity API docs: https://developer.paylocity.com/integrations/reference
 * Endpoint: GET /v2/companies/{companyId}/employees
 */
export async function syncEmployeesFromPaylocity(): Promise<IngestionResult> {
  // TODO: Implement Paylocity OAuth flow
  // TODO: Map Paylocity employee object to ParsedEmployee
  // TODO: Upsert to employees table keyed on paylocityId
  throw new Error('Paylocity sync not yet implemented.')
}
