import { SignOutButton } from '@clerk/nextjs'
import { ShieldX } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto px-4 text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <ShieldX className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Access Denied</h1>
          <p className="text-muted-foreground">
            MeetOPS is restricted to Nellis Auction employees.
            You must sign in with your{' '}
            <span className="font-medium text-foreground">@nellisauction.com</span>{' '}
            email address.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <SignOutButton redirectUrl="/sign-in">
            <button className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              Sign out and use a different account
            </button>
          </SignOutButton>
        </div>
      </div>
    </div>
  )
}
