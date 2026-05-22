import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// cn() merges Tailwind classes without conflicts.
// Use this everywhere instead of template literals for class names.
// Example: cn('px-4 py-2', isActive && 'bg-blue-500', className)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
