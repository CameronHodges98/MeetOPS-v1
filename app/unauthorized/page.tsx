'use client'

import { SignOutButton } from '@clerk/nextjs'
import { ShieldX } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
      <div className="max-w-md w-full mx-auto px-4 text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
            <ShieldX className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            Access Denied
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            MeetOPS is restricted to Nellis Auction employees.
            You must sign in with your{' '}
            <span className="font-medium text-gray-900 dark:text-gray-100">@nellisauction.com</span>{' '}
            email address.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <SignOutButton redirectUrl="/sign-in">
            <button className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              Sign out and use a different account
            </button>
          </SignOutButton>
        </div>
      </div>
    </div>
  )
}
