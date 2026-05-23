'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { BarChart3, Clock, Users, TrendingUp, Zap, Upload } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const NAV_LINKS = [
  { label: 'Shift Plan',   href: '/shift-plan',   icon: Users },
  { label: 'UPH Tracker',  href: '/uph-tracker',  icon: TrendingUp },
  { label: 'Cycle Time',   href: '/cycle-time',   icon: Clock },
  { label: 'Coaching',     href: '/coaching',     icon: BarChart3 },
  { label: 'Import',       href: '/import',       icon: Upload },
] as const

export function Navbar() {
  const pathname = usePathname()

  return (
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

          {/* Clerk user menu */}
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>
    </header>
  )
}
