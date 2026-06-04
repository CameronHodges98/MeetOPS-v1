import { auth } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { neon } from '@neondatabase/serverless'
import { Zap, Loader2 } from 'lucide-react'

export default async function CompleteSignupPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const { userId } = await auth()

  if (!userId) redirect('/sign-in')

  const sql = neon(process.env.DATABASE_URL!)

  // Validate the invite
  const rows = await sql`
    SELECT id, email, role, expires_at, used_at
    FROM invites
    WHERE token = ${token}
    LIMIT 1
  `

  const invite = rows[0]

  if (!invite || invite.used_at || new Date() > new Date(invite.expires_at)) {
    return (
      <ErrorScreen message="This invite link is invalid, expired, or has already been used." />
    )
  }

  // Verify the signed-up email matches the invite
  const client = await clerkClient()
  const clerkUser = await client.users.getUser(userId)
  const email = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId
  )?.emailAddress

  if (!email || email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <ErrorScreen message={`This invite was sent to ${invite.email}. Please sign up with that email address.`} />
    )
  }

  // Create the app_users record
  await sql`
    INSERT INTO app_users (clerk_id, email, name, role, is_active)
    VALUES (
      ${userId},
      ${email},
      ${`${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() || email},
      ${invite.role},
      true
    )
    ON CONFLICT (clerk_id) DO UPDATE
      SET role = EXCLUDED.role, is_active = true, updated_at = NOW()
  `

  // Mark invite as used
  await sql`
    UPDATE invites
    SET used_at = NOW(), used_by_clerk_id = ${userId}
    WHERE id = ${invite.id}
  `

  // Sync role into Clerk publicMetadata for client-side nav filtering
  await client.users.updateUserMetadata(userId, {
    publicMetadata: { role: invite.role },
  })

  redirect('/')
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-sm w-full text-center space-y-4 px-4">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
            <Zap className="h-6 w-6 text-red-500" />
          </div>
        </div>
        <h1 className="text-xl font-bold">Sign Up Error</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <a href="/sign-in" className="inline-block text-sm text-primary hover:underline">
          Go to sign in
        </a>
      </div>
    </div>
  )
}
