import { redirect } from 'next/navigation'
import { neon } from '@neondatabase/serverless'
import { Zap } from 'lucide-react'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const sql = neon(process.env.DATABASE_URL!)

  const rows = await sql`
    SELECT email, role, expires_at, used_at
    FROM invites
    WHERE token = ${token}
    LIMIT 1
  `

  const invite = rows[0]

  if (!invite) {
    return <ErrorScreen message="This invite link is invalid or does not exist." />
  }

  if (invite.used_at) {
    return <ErrorScreen message="This invite link has already been used." />
  }

  if (new Date() > new Date(invite.expires_at)) {
    return <ErrorScreen message="This invite link has expired. Ask your manager to send a new one." />
  }

  // Valid invite — send them to Clerk sign-up
  // The token rides in the redirect URL so complete-signup can finish the flow
  redirect(`/sign-up?redirect_url=/complete-signup/${token}`)
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
        <h1 className="text-xl font-bold">Invite Link Error</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <a
          href="/sign-in"
          className="inline-block text-sm text-primary hover:underline"
        >
          Go to sign in
        </a>
      </div>
    </div>
  )
}
