import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'

const ALLOWED_DOMAIN = '@nellisauction.com'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/unauthorized',
  '/invite(.*)',                      // CT invite acceptance page
  '/api/coaching/invites/(.*)',       // token validation — no auth needed to check if a link is valid
])

export default clerkMiddleware(async (auth, request) => {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  // Let public routes through immediately
  if (isPublicRoute(request)) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // Require authentication for all other routes
  await auth.protect()

  // sessionClaims is decoded from the Clerk session token and includes
  // publicMetadata without an API call. This is safe in Clerk v6 because
  // session.reload() is called after invite acceptance to refresh the token.
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.next({ request: { headers: requestHeaders } })

  const role = (sessionClaims?.publicMetadata as Record<string, unknown>)?.role as string | undefined

  // CTs can only access coaching routes
  if (role === 'ct') {
    const path = request.nextUrl.pathname
    const allowed =
      path.startsWith('/coaching') ||
      path.startsWith('/api/coaching') ||
      path.startsWith('/sign-in') ||
      path.startsWith('/sign-up')
    if (!allowed) {
      return NextResponse.redirect(new URL('/coaching', request.url))
    }
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // Other named roles (manager, ops, gm) bypass domain check
  if (role) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // No role set — must have a @nellisauction.com email.
  // Only now do we call the Clerk API (once per user until they get a role assigned).
  // Wrapped in try-catch so a Clerk API failure never turns into a 404.
  try {
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
    if (primary && !primary.emailAddress.endsWith(ALLOWED_DOMAIN)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  } catch {
    // If Clerk API is unavailable, fail open for authenticated users.
    // A Clerk outage should not lock out legitimate managers.
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
}
