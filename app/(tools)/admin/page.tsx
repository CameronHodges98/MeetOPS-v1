'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Plus, Trash2, Copy, Check, UserX, Pencil, X, Shield } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { ROLE_LABELS, INVITABLE_ROLES, type AppRole } from '@/config/roles'
import type { AppUser, Invite } from '@/lib/db/schema'

// ── Queries ───────────────────────────────────────────────────

function useUsers() {
  return useQuery<AppUser[]>({
    queryKey: ['admin-users'],
    queryFn: () => fetch('/api/admin/users').then((r) => r.json()),
  })
}

function useInvites() {
  return useQuery<Invite[]>({
    queryKey: ['admin-invites'],
    queryFn: () => fetch('/api/admin/invites').then((r) => r.json()),
  })
}

// ── Role badge ────────────────────────────────────────────────

const ROLE_BADGE: Record<AppRole, string> = {
  root: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  gm:   'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  ops:  'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  am:   'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
  ct:   'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
}

function RoleBadge({ role }: { role: AppRole }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', ROLE_BADGE[role])}>
      {ROLE_LABELS[role]}
    </span>
  )
}

// ── Invite form ───────────────────────────────────────────────

function InviteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AppRole>('am')
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const createInvite = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      if (!res.ok) throw new Error('Failed to create invite')
      return res.json() as Promise<Invite>
    },
    onSuccess: (invite) => {
      const base = window.location.origin
      setGeneratedLink(`${base}/invite/${invite.token}`)
      qc.invalidateQueries({ queryKey: ['admin-invites'] })
    },
  })

  function copyLink() {
    if (!generatedLink) return
    navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">Send Invite</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!generatedLink ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="employee@example.com"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AppRole)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {INVITABLE_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => createInvite.mutate()}
              disabled={!email || createInvite.isPending}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {createInvite.isPending ? 'Generating…' : 'Generate invite link'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Invite link generated for <span className="font-medium text-foreground">{email}</span>.
              This link expires in <span className="font-medium text-foreground">36 hours</span>.
            </p>
            <div className="rounded-lg bg-muted/50 border border-border p-3 break-all text-xs font-mono text-foreground">
              {generatedLink}
            </div>
            <button
              onClick={copyLink}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <button
              onClick={onClose}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Edit role / ops assignment row ────────────────────────────

function EditUserRow({
  user,
  opsList,
  onClose,
}: {
  user: AppUser
  opsList: AppUser[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [role, setRole] = useState<AppRole>(user.role as AppRole)
  const [opsId, setOpsId] = useState<string>(user.opsManagerClerkId ?? '')

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          opsManagerClerkId: role === 'am' ? (opsId || null) : null,
        }),
      })
      if (!res.ok) throw new Error('Failed to update user')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      onClose()
    },
  })

  return (
    <tr className="border-b border-border bg-primary/5">
      <td className="px-4 py-2.5 text-sm font-medium">{user.name || user.email}</td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground">{user.email}</td>
      <td className="px-4 py-2.5">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as AppRole)}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
          {INVITABLE_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2.5">
        {role === 'am' ? (
          <select
            value={opsId}
            onChange={(e) => setOpsId(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            <option value="">— Unassigned —</option>
            {opsList.map((o) => (
              <option key={o.clerkId} value={o.clerkId}>
                {o.name || o.email}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Save
          </button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function AdminPage() {
  const qc = useQueryClient()
  const { data: users = [], isLoading: usersLoading } = useUsers()
  const { data: inviteList = [] } = useInvites()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const activeUsers = users.filter((u) => u.isActive)
  const opsList = activeUsers.filter((u) => u.role === 'ops')

  const deactivate = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const revokeInvite = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin/invites/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-invites'] }),
  })

  const pendingInvites = inviteList.filter(
    (i) => !i.usedAt && new Date() < new Date(i.expiresAt)
  )

  return (
    <div className="space-y-8">
      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}

      <PageHeader
        title="Admin"
        description="Manage users, roles, and invite access to MeetOPS"
        actions={
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Invite user
          </button>
        }
      />

      {/* ── Active users ── */}
      <section>
        <h2 className="text-sm font-semibold mb-3">
          Active Users <span className="text-muted-foreground font-normal">({activeUsers.length})</span>
        </h2>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Name</th>
                <th className="px-4 py-2.5 text-left font-medium">Email</th>
                <th className="px-4 py-2.5 text-left font-medium">Role</th>
                <th className="px-4 py-2.5 text-left font-medium">Reports To</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">Loading…</td></tr>
              ) : activeUsers.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">No users yet</td></tr>
              ) : activeUsers.map((u, i) => {
                const isRoot = u.role === 'root'
                const opsManager = u.role === 'am' && u.opsManagerClerkId
                  ? activeUsers.find((o) => o.clerkId === u.opsManagerClerkId)
                  : null

                if (editingId === u.id) {
                  return (
                    <EditUserRow
                      key={u.id}
                      user={u}
                      opsList={opsList}
                      onClose={() => setEditingId(null)}
                    />
                  )
                }

                return (
                  <tr key={u.id} className={cn('border-b last:border-0 border-border', i % 2 !== 0 && 'bg-muted/20')}>
                    <td className="px-4 py-2.5 font-medium">
                      <div className="flex items-center gap-1.5">
                        {isRoot && <Shield className="h-3.5 w-3.5 text-purple-500 shrink-0" />}
                        {u.name || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{u.email}</td>
                    <td className="px-4 py-2.5"><RoleBadge role={u.role as AppRole} /></td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {opsManager ? (opsManager.name || opsManager.email) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        {!isRoot && (
                          <>
                            <button
                              onClick={() => setEditingId(u.id)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title="Edit role"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => { if (confirm(`Remove ${u.name || u.email}?`)) deactivate.mutate(u.id) }}
                              className="text-muted-foreground hover:text-red-500 transition-colors"
                              title="Deactivate user"
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Pending invites ── */}
      <section>
        <h2 className="text-sm font-semibold mb-3">
          Pending Invites <span className="text-muted-foreground font-normal">({pendingInvites.length})</span>
        </h2>
        {pendingInvites.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No pending invites.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Email</th>
                  <th className="px-4 py-2.5 text-left font-medium">Role</th>
                  <th className="px-4 py-2.5 text-left font-medium">Expires</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((inv, i) => (
                  <tr key={inv.id} className={cn('border-b last:border-0 border-border', i % 2 !== 0 && 'bg-muted/20')}>
                    <td className="px-4 py-2.5 font-medium">{inv.email}</td>
                    <td className="px-4 py-2.5"><RoleBadge role={inv.role as AppRole} /></td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {new Date(inv.expiresAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => revokeInvite.mutate(inv.id)}
                        className="text-muted-foreground hover:text-red-500 transition-colors"
                        title="Revoke invite"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
