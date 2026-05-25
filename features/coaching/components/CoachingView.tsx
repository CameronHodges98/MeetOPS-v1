'use client'

import * as Tabs from '@radix-ui/react-tabs'
import { Users, ClipboardList, FileText } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { CandidatesDashboard } from './CandidatesDashboard'
import { AssignmentBoard } from './AssignmentBoard'
import { TemplatesManager } from './TemplatesManager'

const TABS = [
  { value: 'candidates', label: 'Candidates', icon: Users },
  { value: 'assignments', label: 'Assignments', icon: ClipboardList },
  { value: 'templates', label: 'Templates', icon: FileText },
]

export function CoachingView() {
  return (
    <Tabs.Root defaultValue="candidates" className="space-y-4">
      <Tabs.List className="flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
        {TABS.map(({ value, label, icon: Icon }) => (
          <Tabs.Trigger
            key={value}
            value={value}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              'text-muted-foreground hover:text-foreground',
              'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <Tabs.Content value="candidates">
        <CandidatesDashboard />
      </Tabs.Content>

      <Tabs.Content value="assignments">
        <AssignmentBoard />
      </Tabs.Content>

      <Tabs.Content value="templates">
        <TemplatesManager />
      </Tabs.Content>
    </Tabs.Root>
  )
}
