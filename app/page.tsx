import Link from 'next/link'
import { Clock, Users, TrendingUp, GraduationCap, ArrowRight } from 'lucide-react'

const TOOLS = [
  {
    title: 'Shift Plan',
    description: 'Real-time headcount planning. Track staffing vs. demand by department and hour. Flex labor to cover gaps.',
    href: '/shift-plan',
    icon: Users,
    iconColor: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    cardBg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
  },
  {
    title: 'UPH Tracker',
    description: 'Live Points Per Hour by employee, supervisor, and department. Compare actuals against UPH standards.',
    href: '/uph-tracker',
    icon: TrendingUp,
    iconColor: 'text-green-600 dark:text-green-400',
    iconBg: 'bg-green-100 dark:bg-green-900/40',
    cardBg: 'bg-green-50 dark:bg-green-950/30',
    border: 'border-green-200 dark:border-green-800',
  },
  {
    title: 'Cycle Time',
    description: 'Identify per-employee action bottlenecks using consecutive same-action timestamps.',
    href: '/cycle-time',
    icon: Clock,
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    cardBg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
  },
  {
    title: 'Coaching',
    description: 'Performance coaching workflows — identify candidates, assign sessions, and track follow-through.',
    href: '/coaching',
    icon: GraduationCap,
    iconColor: 'text-purple-600 dark:text-purple-400',
    iconBg: 'bg-purple-100 dark:bg-purple-900/40',
    cardBg: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800',
  },
] as const

export default function HubPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">MeetOPS</h1>
        <p className="mt-2 text-muted-foreground">
          Operations management suite — make real-time labor decisions backed by data.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {TOOLS.map((tool) => {
          const Icon = tool.icon
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className={`group block rounded-xl border-2 ${tool.border} ${tool.cardBg} p-6 transition-all hover:shadow-md hover:scale-[1.01]`}
            >
              <div className="flex items-start justify-between">
                <div className={`p-2 rounded-lg ${tool.iconBg}`}>
                  <Icon className={`h-6 w-6 ${tool.iconColor}`} />
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
              <div className="mt-4">
                <h2 className="text-lg font-semibold">{tool.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {tool.description}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
