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

  const { userId } = await auth()
  if (userId) {
    // Fetch user from Clerk API — publicMetadata is authoritative here,
    // unlike JWT claims which require a custom template to embed publicMetadata.
    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    // CTs have role='ct' set in publicMetadata during invite acceptance.
    // They bypass the domain check entirely.
    const role = (user.publicMetadata as Record<string, unknown>)?.role
    if (role) {
      return NextResponse.next({ request: { headers: requestHeaders } })
    }

    // Everyone else must have a @nellisauction.com email.
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
