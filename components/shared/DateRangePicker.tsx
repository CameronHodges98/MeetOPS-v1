'use client'

import { useState } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import * as Popover from '@radix-ui/react-popover'
import { format, subDays, startOfWeek, startOfMonth } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// Import react-day-picker base styles (overridden in globals.css)
import 'react-day-picker/src/style.css'

interface DateRangePickerProps {
  from: string       // yyyy-MM-dd
  to: string         // yyyy-MM-dd
  onRangeChange: (from: string, to: string) => void
  className?: string
}

function toDate(s: string): Date {
  return new Date(s + 'T00:00:00')
}

function fmt(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

const today = () => new Date()

const PRESETS = [
  { label: 'Today',        getRange: () => ({ from: today(), to: today() }) },
  { label: 'Yesterday',    getRange: () => { const d = subDays(today(), 1); return { from: d, to: d } } },
  { label: 'This Week',    getRange: () => ({ from: startOfWeek(today(), { weekStartsOn: 1 }), to: today() }) },
  { label: 'Last 7 Days',  getRange: () => ({ from: subDays(today(), 6), to: today() }) },
  { label: 'Last 14 Days', getRange: () => ({ from: subDays(today(), 13), to: today() }) },
  { label: 'Last 30 Days', getRange: () => ({ from: subDays(today(), 29), to: today() }) },
  { label: 'This Month',   getRange: () => ({ from: startOfMonth(today()), to: today() }) },
]

export function DateRangePicker({ from, to, onRangeChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)

  const selected: DateRange = {
    from: from ? toDate(from) : undefined,
    to:   to   ? toDate(to)   : undefined,
  }

  // Display label
  const isSameDay = from === to
  const displayLabel = from
    ? isSameDay
      ? format(toDate(from), 'MMM d, yyyy')
      : `${format(toDate(from), 'MMM d')} – ${format(toDate(to), 'MMM d, yyyy')}`
    : 'Select range'

  function handleSelect(range: DateRange | undefined) {
    if (!range?.from) return
    const fromStr = fmt(range.from)
    const toStr   = range.to ? fmt(range.to) : fromStr
    onRangeChange(fromStr, toStr)
    if (range.to) setOpen(false)
  }

  function applyPreset(getRange: () => { from: Date; to: Date }) {
    const { from: f, to: t } = getRange()
    onRangeChange(fmt(f), fmt(t))
    setOpen(false)
  }

  // Detect active preset for highlight
  function isActivePreset(getRange: () => { from: Date; to: Date }): boolean {
    const { from: f, to: t } = getRange()
    return fmt(f) === from && fmt(t) === to
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm hover:bg-muted transition-colors whitespace-nowrap',
            className
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span>{displayLabel}</span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 flex rounded-xl border border-border bg-background shadow-2xl overflow-hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Preset shortcuts */}
          <div className="flex flex-col gap-0.5 border-r border-border p-2 min-w-[130px]">
            <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Select
            </p>
            {PRESETS.map((p) => {
              const active = isActivePreset(p.getRange)
              return (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p.getRange)}
                  className={cn(
                    'w-full text-left rounded-md px-2 py-1.5 text-sm transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  {p.label}
                </button>
              )
            })}
          </div>

          {/* Calendar */}
          <div className="p-3">
            <DayPicker
              mode="range"
              selected={selected}
              onSelect={handleSelect}
              numberOfMonths={1}
              defaultMonth={selected.from}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
