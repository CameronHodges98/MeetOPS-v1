'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Copy, Check, Loader2, Link2 } from 'lucide-react'

interface InviteCtModalProps {
  open: boolean
  onClose: () => void
}

export function InviteCtModal({ open, onClose }: InviteCtModalProps) {
  const [generating, setGenerating] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/coaching/invites', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to generate invite')
      const data = await res.json()
      setInviteUrl(data.url)
      setExpiresAt(data.expiresAt)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  async function copyToClipboard() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleClose() {
    setInviteUrl(null)
    setExpiresAt(null)
    setCopied(false)
    setError('')
    onClose()
  }

  const expiryLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
          <div className="flex items-start justify-between mb-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">Invite a Certified Trainer</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                Generate a one-time link. The CT signs up with any email — no @nellisauction.com required.
              </Dialog.Description>
            </div>
            <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            {!inviteUrl ? (
              <>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0 mt-2" />
                    Link expires in 7 days and can only be used once
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0 mt-2" />
                    CT signs up with their personal email (Gmail, iCloud, etc.)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0 mt-2" />
                    They set their own name and availability (weekday / weekend / both)
                  </li>
                </ul>

                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                <button
                  onClick={generate}
                  disabled={generating}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {generating ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                  ) : (
                    <><Link2 className="h-4 w-4" /> Generate Invite Link</>
                  )}
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Invite link (expires {expiryLabel})</p>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-xs font-mono break-all text-foreground">{inviteUrl}</p>
                    <button
                      onClick={copyToClipboard}
                      className="shrink-0 flex items-center justify-center h-8 w-8 rounded-md border border-border hover:bg-muted transition-colors"
                      title="Copy to clipboard"
                    >
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Send this link to the CT via text or email. They&apos;ll sign up with their personal account and be added to MeetOPS automatically.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setInviteUrl(null); setExpiresAt(null) }}
                    className="flex-1 rounded-md border border-border py-2 text-sm hover:bg-muted transition-colors"
                  >
                    Generate another
                  </button>
                  <button
                    onClick={handleClose}
                    className="flex-1 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
