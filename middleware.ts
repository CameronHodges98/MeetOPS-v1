import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'

const ALLOWED_DOMAIN = '@nellisauction.com'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/unauthorized',
])

export default clerkMiddleware(async (auth, request) => {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  if (isPublicRoute(request)) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  await auth.protect()

  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.next({ request: { headers: requestHeaders } })

  const role = (sessionClaims?.publicMetadata as Record<string, unknown>)?.role as string | undefined

  // Named roles (manager, ops, gm) bypass domain check
  if (role) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // No role set — must have a @nellisauction.com email
  try {
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
    if (primary && !primary.emailAddress.endsWith(ALLOWED_DOMAIN)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  } catch {
    // If Clerk API is unavailable, fail open for authenticated users
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
