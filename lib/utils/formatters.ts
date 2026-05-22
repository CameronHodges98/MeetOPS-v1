import type { PerformanceStatus } from './uphCalculator'

// ============================================================
// Number Formatting
// ============================================================

export function formatPPH(pph: number): string {
  return pph.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatPoints(points: number): string {
  return points.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export function formatCount(count: number): string {
  return count.toLocaleString('en-US')
}

// ============================================================
// Performance Status Display
// Maps status enum to label and color class for UI components
// ============================================================

export const STATUS_DISPLAY: Record<
  PerformanceStatus,
  { label: string; colorClass: string; bgClass: string; dotClass: string }
> = {
  on_target: {
    label: 'On Target',
    colorClass: 'text-green-700',
    bgClass: 'bg-green-100',
    dotClass: 'bg-green-500',
  },
  watch: {
    label: 'Watch',
    colorClass: 'text-amber-700',
    bgClass: 'bg-amber-100',
    dotClass: 'bg-amber-500',
  },
  needs_attention: {
    label: 'Needs Attention',
    colorClass: 'text-red-700',
    bgClass: 'bg-red-100',
    dotClass: 'bg-red-500',
  },
  insufficient_data: {
    label: 'Insufficient Data',
    colorClass: 'text-gray-500',
    bgClass: 'bg-gray-100',
    dotClass: 'bg-gray-400',
  },
}

// ============================================================
// Cycle Time Ratio Display
// ============================================================

export function formatCycleRatio(ratio: number): string {
  return `${ratio.toFixed(2)}×`
}

export function getCycleRatioColorClass(ratio: number): string {
  if (ratio <= 1.0) return 'text-green-700'
  if (ratio <= 1.5) return 'text-amber-700'
  return 'text-red-700'
}

// ============================================================
// Name Formatting
// ============================================================

export function formatEmployeeName(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

// ============================================================
// Job Title Abbreviations (for compact table views)
// ============================================================

export const JOB_TITLE_ABBREV: Record<string, string> = {
  'Picker': 'PKR',
  'Inventory Processor': 'INV',
  'Load Out': 'LO',
  'Put Away': 'PA',
  'Lot Attendant': 'LOT',
  'Returns Clerk': 'RET',
  'Material Handler': 'MH',
  'Area Manager': 'AM',
  'Safety Coordinator': 'SAF',
}
