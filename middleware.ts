import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'

const ALLOWED_DOMAIN = '@nellisauction.com'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/unauthorized',
  '/invite(.*)',   // CT invite acceptance route
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

  const { userId, sessionClaims } = await auth()
  if (userId) {
    // Fast path: users with a role in Clerk publicMetadata bypass the domain check.
    // CTs are granted role='ct' via invite flow and shouldn't need @nellisauction.com.
    const role = (sessionClaims?.publicMetadata as Record<string, unknown> | undefined)?.role
    if (role) {
      return NextResponse.next({ request: { headers: requestHeaders } })
    }

    // Slow path: check email domain via Clerk API
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
    if (primary && !primary.emailAddress.endsWith(ALLOWED_DOMAIN)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
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
