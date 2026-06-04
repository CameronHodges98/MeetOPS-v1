'use client'

import { SignOutButton } from '@clerk/nextjs'
import { ShieldX } from 'lucide-react'

export default function BlockedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full text-center space-y-6 px-4">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
            <ShieldX className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Access Denied</h1>
          <p className="text-sm text-muted-foreground">
            You are not authorized to access MeetOPS. Contact your manager to request an invite.
          </p>
        </div>
        <SignOutButton redirectUrl="/sign-in">
          <button className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            Sign out
          </button>
        </SignOutButton>
      </div>
    </div>
  )
}
