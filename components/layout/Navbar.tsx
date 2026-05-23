'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { BarChart3, Clock, Users, TrendingUp, Zap, Upload, Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { ImportModal } from '@/components/shared/ImportModal'
import { useTheme } from '@/components/theme/ThemeProvider'
import { WarehouseSelector } from '@/components/layout/WarehouseSelector'

const NAV_LINKS = [
  { label: 'Shift Plan',   href: '/shift-plan',   icon: Users },
  { label: 'UPH Tracker',  href: '/uph-tracker',  icon: TrendingUp },
  { label: 'Cycle Time',   href: '/cycle-time',   icon: Clock },
  { label: 'Coaching',     href: '/coaching',     icon: BarChart3 },
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

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 max-w-screen-2xl">
          <div className="flex h-14 items-center gap-6">
            {/* Brand */}
            <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
              <Zap className="h-5 w-5 text-primary" />
              MeetOPS
            </Link>

            {/* Tool navigation */}
            <nav className="flex items-center gap-1 flex-1">
              {NAV_LINKS.map(({ label, href, icon: Icon }) => {
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

            {/* Right side */}
            <div className="flex items-center gap-3 shrink-0">
              <WarehouseSelector />
              <ThemeToggle />
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <Upload className="h-4 w-4" />
                Import
              </button>
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
          </div>
        </div>
      </header>

      <ImportModal open={importOpen} onOpenChange={setImportOpen} />
    </>
  )
}
