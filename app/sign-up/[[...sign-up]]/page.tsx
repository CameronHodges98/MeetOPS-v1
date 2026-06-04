'use client'

import { SignUp } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SignUpForm() {
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get('redirect_url') ?? '/'
  return <SignUp forceRedirectUrl={redirectUrl} />
}

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Suspense>
        <SignUpForm />
      </Suspense>
    </div>
  )
}
