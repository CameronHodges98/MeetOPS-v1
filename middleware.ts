import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { ROOT_EMAIL, ROUTE_PERMISSIONS, CT_HOME, type AppRole } from '@/config/roles'

// Public: no Clerk auth required
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])

// Auth-flow routes: Clerk auth required but DB check bypassed
const isBypassRoute = createRouteMatcher(['/invite(.*)', '/complete-signup(.*)', '/blocked'])

// The only API surfaces a Certified Trainer is permitted to call. Everything
// else under /api is denied for CTs — the page lockdown below is mirrored at
// the data layer so a CT cannot reach another tool's data by hand.
const CT_API_PREFIXES = [
  '/api/coaching/ct/',        // their own session list
  '/api/coaching/sessions/',  // PATCH own session (route enforces ownership)
  '/api/coaching/checklists', // GET observation checklists (route enforces writes)
]
function isCtAllowedApi(path: string) {
  return CT_API_PREFIXES.some((p) => path.startsWith(p))
}

export default clerkMiddleware(async (auth, request) => {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  if (isPublicRoute(request)) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // All other routes require a valid Clerk session
  await auth.protect()

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  // Auth-flow pages skip the DB check entirely
  const path = request.nextUrl.pathname
  if (isBypassRoute(request)) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  const sql = neon(process.env.DATABASE_URL!)

  // ── API routes ────────────────────────────────────────────────
  // Per-route handlers own their authz. Middleware only enforces the CT
  // lockdown here: a CT may hit nothing under /api except their allowlist.
  // Unknown/mid-invite roles fall through to the route's own auth check.
  if (path.startsWith('/api/')) {
    const apiRows = await sql`
      SELECT role FROM app_users WHERE clerk_id = ${userId} AND is_active = true LIMIT 1
    `
    const apiRole = apiRows[0]?.role as AppRole | undefined
    if (apiRole === 'ct' && !isCtAllowedApi(path)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // ── DB check: verify user is in app_users and active ──────────
  const rows = await sql`
    SELECT role, is_active FROM app_users
    WHERE clerk_id = ${userId}
    LIMIT 1
  `

  let role = rows[0]?.role as AppRole | undefined

  // Root bootstrapping: auto-create the root user on first sign-in
  if (!role) {
    const client = await clerkClient()
    const clerkUser = await client.users.getUser(userId)
    const email = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress

    if (email === ROOT_EMAIL) {
      await sql`
        INSERT INTO app_users (clerk_id, email, name, role, is_active)
        VALUES (
          ${userId},
          ${ROOT_EMAIL},
          ${`${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim()},
          'root',
          true
        )
        ON CONFLICT (clerk_id) DO NOTHING
      `
      await client.users.updateUserMetadata(userId, {
        publicMetadata: { role: 'root' },
      })
      role = 'root'
    }
  }

  // Not in DB or inactive → blocked
  if (!role || rows[0]?.is_active === false) {
    return NextResponse.redirect(new URL('/blocked', request.url))
  }

  // ── Certified Trainer lockdown ────────────────────────────────
  // CTs may only ever see their own workspace. Any other page route
  // (hub, tools, coaching board, admin) bounces back to /ct.
  if (role === 'ct' && !path.startsWith(CT_HOME)) {
    return NextResponse.redirect(new URL(CT_HOME, request.url))
  }

  // Route-level permission check
  const matchedRoute = Object.keys(ROUTE_PERMISSIONS).find((r) => path.startsWith(r))
  if (matchedRoute) {
    const allowed = ROUTE_PERMISSIONS[matchedRoute]
    if (!allowed.includes(role)) {
      return NextResponse.redirect(new URL('/blocked', request.url))
    }
  }

  requestHeaders.set('x-user-role', role)
  return NextResponse.next({ request: { headers: requestHeaders } })
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
}
