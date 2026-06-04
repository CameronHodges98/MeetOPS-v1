'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton, useUser } from '@clerk/nextjs'
import { Clock, Users, TrendingUp, GraduationCap, Shield, Zap, Upload, Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { ImportModal } from '@/components/shared/ImportModal'
import { useTheme } from '@/components/theme/ThemeProvider'
import { WarehouseSelector } from '@/components/layout/WarehouseSelector'
import { ROUTE_PERMISSIONS, type AppRole } from '@/config/roles'

const NAV_LINKS = [
  { label: 'Shift Plan',  href: '/shift-plan',  icon: Users },
  { label: 'Coaching',    href: '/coaching',    icon: GraduationCap },
  { label: 'Cycle Time',  href: '/cycle-time',  icon: Clock },
  { label: 'UPH Tracker', href: '/uph-tracker', icon: TrendingUp },
  { label: 'Admin',       href: '/admin',       icon: Shield },
] as const

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const options = [
    { value: 'light', icon: Sun },
    { value: 'system', icon: Monitor },
    { value: 'dark', icon: Moon },
  ] as const
  return (
    <div className="flex items-center rounded-md border border-border bg-muted p-0.5 gap-0.5">
      {options.map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={value.charAt(0).toUpperCase() + value.slice(1)}
          className={cn(
            'flex items-center justify-center h-7 w-7 rounded transition-colors',
            theme === value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}

export function Navbar() {
  const pathname = usePathname()
  const [importOpen, setImportOpen] = useState(false)
  const { user, isLoaded, isSignedIn } = useUser()
  const role = (user?.publicMetadata as Record<string, unknown>)?.role as AppRole | undefined

  // After invite sign-up, publicMetadata may not be in the session token yet.
  // Force a reload once so the role propagates without requiring a manual refresh.
  useEffect(() => {
    if (isLoaded && isSignedIn && !role) {
      user?.reload()
    }
  }, [isLoaded, isSignedIn, role, user])

  const visibleLinks = NAV_LINKS.filter(({ href }) => {
    const allowed = ROUTE_PERMISSIONS[href]
    if (!allowed) return true
    if (!role) return false
    return allowed.includes(role)
  })

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 max-w-screen-2xl">
          <div className="flex h-14 items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
              <Zap className="h-5 w-5 text-primary" />
              MeetOPS
            </Link>

            <nav className="flex items-center gap-1 flex-1">
              {visibleLinks.map(({ label, href, icon: Icon }) => {
                const isActive = pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                )
              })}
            </nav>

            <div className="flex items-center gap-3 shrink-0">
              <WarehouseSelector />
              <ThemeToggle />
              {role && ['root', 'gm', 'ops', 'am'].includes(role) && (
                <button
                  onClick={() => setImportOpen(true)}
                  className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <Upload className="h-4 w-4" />
                  Import
                </button>
              )}
              <UserButton />
            </div>
          </div>
        </div>
      </header>

      <ImportModal open={importOpen} onOpenChange={setImportOpen} />
    </>
  )
}
