'use client'

import { X, CircleHelp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface HelpSection {
  title: string
  body: string | string[]
}

interface HelpModalProps {
  title: string
  subtitle?: string
  sections: HelpSection[]
  isOpen: boolean
  onClose: () => void
}

export function HelpModal({ title, subtitle, sections, isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full bg-background border border-border rounded-2xl shadow-2xl flex flex-col" style={{ minWidth: '50vw', maxWidth: '75vw', maxHeight: '75vh' }}>
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2.5">
              <CircleHelp className="h-5 w-5 text-primary shrink-0" />
              <div>
                <h2 className="text-base font-bold">{title}</h2>
                {subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Sections */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {sections.map((section, i) => (
              <div key={i}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-1.5">
                  {section.title}
                </h3>
                {Array.isArray(section.body) ? (
                  <ul className="space-y-1">
                    {section.body.map((line, j) => (
                      <li key={j} className="text-sm text-muted-foreground flex gap-2">
                        <span className="text-primary mt-0.5 shrink-0">·</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed">{section.body}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

interface HelpButtonProps {
  onClick: () => void
  className?: string
}

export function HelpButton({ onClick, className }: HelpButtonProps) {
  return (
    <button
      onClick={onClick}
      title="How to use this page"
      className={cn(
        'flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
        className
      )}
    >
      <CircleHelp className="h-4 w-4" />
      Reference
    </button>
  )
}
