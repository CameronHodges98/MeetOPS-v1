import { SignIn } from '@clerk/nextjs'
import { Zap, TrendingUp, Clock, Users, BarChart3 } from 'lucide-react'

const FEATURES = [
  { icon: TrendingUp, label: 'UPH Tracker',  description: 'Live Points Per Hour by employee and department' },
  { icon: Clock,      label: 'Cycle Time',   description: 'Identify bottlenecks with per-action timing data' },
  { icon: Users,      label: 'Shift Plan',   description: 'Real-time headcount planning against demand' },
  { icon: BarChart3,  label: 'Coaching',     description: 'Track performance improvement end-to-end' },
]

export default function SignInPage() {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Left — welcome panel */}
      <div className="hidden lg:flex flex-col justify-between bg-zinc-900 text-white p-12">
        <div className="flex items-center gap-2 text-lg font-bold">
          <Zap className="h-5 w-5 text-blue-400" />
          MeetOPS
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold leading-tight">
              Operations data,<br />built for the floor.
            </h1>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-sm">
              Real-time labor decisions backed by warehouse data.
              Built for Nellis Auction operations teams.
            </p>
          </div>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, label, description }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 mt-0.5">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-zinc-400">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-zinc-500">
          Access restricted to @nellisauction.com accounts.
        </p>
      </div>

      {/* Right — sign in form */}
      <div className="flex flex-col items-center justify-center bg-background p-8">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile brand (hidden on lg) */}
          <div className="flex items-center gap-2 font-bold text-lg lg:hidden">
            <Zap className="h-5 w-5 text-primary" />
            MeetOPS
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in with your @nellisauction.com account.
            </p>
          </div>

          <SignIn />
        </div>
      </div>
    </div>
  )
}
