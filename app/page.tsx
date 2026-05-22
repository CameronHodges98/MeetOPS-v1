import Link from 'next/link'
import { BarChart3, Clock, Users, TrendingUp, ArrowRight } from 'lucide-react'

const TOOLS = [
  {
    title: 'Shift Plan',
    description: 'Real-time headcount planning. Track staffing vs. demand by department and hour. Flex labor to cover gaps.',
    href: '/shift-plan',
    icon: Users,
    status: 'active',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    title: 'UPH Tracker',
    description: 'Live Points Per Hour by employee, supervisor, and department. Compare actuals against UPH standards.',
    href: '/uph-tracker',
    icon: TrendingUp,
    status: 'active',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  {
    title: 'Cycle Time',
    description: 'Identify per-employee action bottlenecks using consecutive same-action timestamps. Data-driven coaching points.',
    href: '/cycle-time',
    icon: Clock,
    status: 'active',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  {
    title: 'Coaching',
    description: 'Assign trainers, track coaching sessions, and manage performance improvement workflows end-to-end.',
    href: '/coaching',
    icon: BarChart3,
    status: 'active',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
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
              className={`group block rounded-xl border-2 ${tool.borderColor} ${tool.bgColor} p-6 transition-all hover:shadow-md hover:scale-[1.01]`}
            >
              <div className="flex items-start justify-between">
                <div className={`p-2 rounded-lg bg-white shadow-sm`}>
                  <Icon className={`h-6 w-6 ${tool.color}`} />
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
