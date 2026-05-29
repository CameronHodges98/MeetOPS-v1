'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser, useSession, SignIn } from '@clerk/nextjs'
import { Zap, CheckCircle2, XCircle, Loader2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type TokenStatus = 'loading' | 'valid' | 'invalid' | 'already_used' | 'expired'
type AcceptStatus = 'idle' | 'accepting' | 'done' | 'error'

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const { user, isLoaded } = useUser()
  const { session } = useSession()
  const router = useRouter()

  const [tokenStatus, setTokenStatus] = useState<TokenStatus>('loading')
  const [acceptStatus, setAcceptStatus] = useState<AcceptStatus>('idle')
  const [displayName, setDisplayName] = useState('')
  const [schedule, setSchedule] = useState<'weekday' | 'weekend' | 'both'>('both')
  const [errorMsg, setErrorMsg] = useState('')

  // Validate the token on load
  useEffect(() => {
    fetch(`/api/coaching/invites/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) {
          setTokenStatus('valid')
        } else {
          setTokenStatus(data.reason === 'already_used' ? 'already_used' : data.reason === 'expired' ? 'expired' : 'invalid')
        }
      })
      .catch(() => setTokenStatus('invalid'))
  }, [token])

  // Pre-fill display name from Clerk if available
  useEffect(() => {
    if (user && !displayName) {
      setDisplayName(user.fullName ?? user.firstName ?? '')
    }
  }, [user, displayName])

  async function handleAccept() {
    setAcceptStatus('accepting')
    try {
      const res = await fetch(`/api/coaching/invites/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() || undefined, trainerSchedule: schedule }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to accept invite')
      }
      setAcceptStatus('done')
      // Force a new JWT so the updated publicMetadata.role is in the session
      // claims before the middleware checks it on /coaching.
      await session?.reload()
      // Hard redirect (not router.push) so the browser sends the refreshed
      // cookie on a full request — client-side navigation can race ahead of
      // the updated JWT and hit the domain check before it propagates.
      setTimeout(() => { window.location.href = '/coaching' }, 1500)
    } catch (e: unknown) {
      setAcceptStatus('error')
      setErrorMsg(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 text-xl font-bold">
          <Zap className="h-6 w-6 text-primary" />
          MeetOPS
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-5">
          {/* Token validation states */}
          {tokenStatus === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-4 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Validating invite…</p>
            </div>
          )}

          {tokenStatus === 'invalid' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <XCircle className="h-10 w-10 text-red-500" />
              <p className="font-semibold">Invalid invite link</p>
              <p className="text-sm text-muted-foreground">This link doesn&apos;t exist or was removed. Ask your manager to generate a new one.</p>
            </div>
          )}

          {tokenStatus === 'expired' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <XCircle className="h-10 w-10 text-amber-500" />
              <p className="font-semibold">Invite expired</p>
              <p className="text-sm text-muted-foreground">This invite link expired (links are valid for 7 days). Ask your manager to send a new one.</p>
            </div>
          )}

          {tokenStatus === 'already_used' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="font-semibold">Already accepted</p>
              <p className="text-sm text-muted-foreground">This invite has already been used. If you&apos;re having trouble accessing MeetOPS, contact your manager.</p>
            </div>
          )}

          {tokenStatus === 'valid' && (
            <>
              <div className="text-center">
                <p className="font-semibold text-lg">You&apos;ve been invited as a Certified Trainer</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sign in or create an account, then complete your profile to get started.
                </p>
              </div>

              {/* Not signed in — show Clerk sign-in */}
              {isLoaded && !user && (
                <div className="space-y-3">
                  <p className="text-sm text-center text-muted-foreground">Sign in or create an account to continue:</p>
                  <SignIn
                    forceRedirectUrl={`/invite/${token}`}
                    appearance={{
                      elements: {
                        rootBox: 'w-full',
                        card: 'shadow-none border-0 p-0',
                      },
                    }}
                  />
                </div>
              )}

              {/* Signed in — show accept form */}
              {isLoaded && user && acceptStatus !== 'done' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Your display name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="How your name appears to managers"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">When are you available to coach?</label>
                    <div className="relative">
                      <select
                        value={schedule}
                        onChange={(e) => setSchedule(e.target.value as typeof schedule)}
                        className="h-9 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-8 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="weekday">Weekdays only (Mon–Thu)</option>
                        <option value="weekend">Weekends only (Fri–Sun)</option>
                        <option value="both">Both weekdays and weekends</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  {errorMsg && (
                    <p className="text-sm text-red-600 dark:text-red-400">{errorMsg}</p>
                  )}

                  <button
                    onClick={handleAccept}
                    disabled={acceptStatus === 'accepting'}
                    className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {acceptStatus === 'accepting' ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Activating account…
                      </span>
                    ) : (
                      'Accept Invite & Continue'
                    )}
                  </button>
                </div>
              )}

              {/* Done */}
              {acceptStatus === 'done' && (
                <div className="flex flex-col items-center gap-3 py-2 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                  <p className="font-semibold">You&apos;re all set!</p>
                  <p className="text-sm text-muted-foreground">Redirecting you to MeetOPS…</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
