'use client'

import { useRef, useState } from 'react'
import { Search, Users, AlertCircle, ClipboardList, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useUser } from '@clerk/nextjs'
import type { AppRole } from '@/config/roles'
import { STAGE_ORDER, STAGE_CONFIG, CARD_STATUS_STYLE } from '../constants'
import { useCoachingRoster, useRosterMove } from '../queries'
import { useCoachingStore } from '../store'
import { EmployeeCard } from './EmployeeCard'
import { EmployeeDrawer } from './EmployeeDrawer'
import { ApprovalsInbox } from './ApprovalsInbox'
import { MoveReasonModal } from './MoveReasonModal'
import { ChecklistManagerModal } from './ChecklistManagerModal'
import type { RosterEntryWithDetails } from '../queries'
import type { EscalationStage } from '@/lib/db/schema'

export function CoachingBoard() {
  const { user } = useUser()
  const role = (user?.publicMetadata as Record<string, unknown>)?.role as AppRole | undefined
  const canDirectMove = role && ['root', 'gm', 'ops'].includes(role)

  const { data, isLoading } = useCoachingRoster()
  const moveMutation = useRosterMove()

  const {
    search, managerFilter,
    selectedEntryId, setSelectedEntryId,
    pendingMove, setPendingMove,
    setSearch, setManagerFilter,
  } = useCoachingStore()

  const dragRef = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<EscalationStage | 'roster' | null>(null)
  const [checklistOpen, setChecklistOpen] = useState(false)

  const entries = data?.entries ?? []
  const weekEmployees = data?.weekEmployees ?? []
  const pendingApprovalsCount = data?.pendingApprovalsCount ?? 0

  // Filter entries
  const filtered = entries.filter((e) => {
    if (search && !e.employeeName.toLowerCase().includes(search.toLowerCase())) return false
    if (managerFilter !== 'all' && e.managerName !== managerFilter) return false
    return true
  })

  // Unique managers for filter
  const managers = [...new Set(entries.map((e) => e.managerName))].sort()

  // Employees from latest week not yet on board (for roster tray supplement)
  const onBoardNames = new Set(entries.map((e) => e.employeeName))
  const untracked = weekEmployees
    .filter((w) => !onBoardNames.has(w.employeeName))
    .filter((w) => {
      if (search && !w.employeeName.toLowerCase().includes(search.toLowerCase())) return false
      if (managerFilter !== 'all' && w.managerName !== managerFilter) return false
      return true
    })

  const rosterEntries = filtered.filter((e) => e.currentStage === 'roster')
  const selectedEntry = entries.find((e) => e.id === selectedEntryId) ?? null

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, id: number) => {
    dragRef.current = id
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e: React.DragEvent, stage: EscalationStage | 'roster') => {
    e.preventDefault()
    setDragOver(stage)
  }
  const handleDrop = (e: React.DragEvent, toStage: EscalationStage) => {
    e.preventDefault()
    setDragOver(null)
    const id = dragRef.current
    dragRef.current = null
    if (!id) return
    const entry = entries.find((x) => x.id === id)
    if (!entry || entry.currentStage === toStage) return

    if (canDirectMove) {
      moveMutation.mutate({ id, body: { action: 'direct_move', toStage } })
    } else {
      setPendingMove({ rosterEntryId: id, fromStage: entry.currentStage, toStage })
    }
  }

  const handleMoveConfirm = (reason: string) => {
    if (!pendingMove) return
    moveMutation.mutate({
      id: pendingMove.rosterEntryId,
      body: { action: 'request_move', toStage: pendingMove.toStage, reason },
    })
    setPendingMove(null)
  }

  const handleRequestMove = (toStage: EscalationStage) => {
    if (!selectedEntry) return
    if (canDirectMove) {
      moveMutation.mutate({ id: selectedEntry.id, body: { action: 'direct_move', toStage } })
    } else {
      setPendingMove({ rosterEntryId: selectedEntry.id, fromStage: selectedEntry.currentStage, toStage })
    }
  }

  // Quick stats
  const totalOnBoard = entries.filter((e) => e.currentStage !== 'roster').length
  const completedCount = entries.filter((e) => e.cardStatus === 'completed').length
  const inProgressCount = entries.filter((e) => e.cardStatus === 'in_progress' && e.currentStage !== 'roster').length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Approvals inbox (OM/GM/Root only) */}
      {role && ['root', 'gm', 'ops'].includes(role) && <ApprovalsInbox />}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-background w-52">
          <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee…"
            className="text-sm bg-transparent outline-none w-full"
          />
        </div>

        {role !== 'am' && (
          <select
            value={managerFilter}
            onChange={(e) => setManagerFilter(e.target.value)}
            className="text-sm border rounded-lg px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All managers</option>
            {managers.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}

        {canDirectMove && (
          <button
            onClick={() => setChecklistOpen(true)}
            className="flex items-center gap-1.5 text-sm border rounded-lg px-3 py-1.5 bg-background hover:bg-muted transition-colors"
          >
            <ListChecks className="h-3.5 w-3.5" />
            Checklists
          </button>
        )}

        <div className="flex-1" />

        {/* Quick stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ClipboardList className="h-4 w-4" />
            <span><strong className="text-foreground">{totalOnBoard}</strong> in coaching</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            <span><strong className="text-foreground">{completedCount}</strong> completed</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            <span><strong className="text-foreground">{inProgressCount}</strong> in progress</span>
          </div>
          {pendingApprovalsCount > 0 && role && ['root', 'gm', 'ops'].includes(role) && (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              <span><strong>{pendingApprovalsCount}</strong> pending</span>
            </div>
          )}
        </div>
      </div>

      {/* Roster tray */}
      <div
        className={cn(
          'flex-shrink-0 border-2 rounded-xl p-3 transition-colors',
          dragOver === 'roster' ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'
        )}
        onDragOver={(e) => handleDragOver(e, 'roster')}
        onDragLeave={() => setDragOver(null)}
        onDrop={(e) => { e.preventDefault(); setDragOver(null); dragRef.current = null }}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Roster</span>
          <span className="text-xs text-muted-foreground">
            unassigned · {rosterEntries.length + untracked.length}
          </span>
          <span className="text-xs text-muted-foreground ml-auto">scroll → · drag card into a stage</span>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1.5">
          {rosterEntries.map((entry) => (
            <div key={entry.id} className="flex-shrink-0 w-44">
              <EmployeeCard
                entry={entry}
                compact
                draggable
                onDragStart={(e) => handleDragStart(e, entry.id)}
                onDragEnd={() => setDragOver(null)}
                onClick={() => setSelectedEntryId(entry.id)}
              />
            </div>
          ))}

          {/* Untracked employees from latest week (no roster entry yet) */}
          {untracked.map((emp) => (
            <div key={emp.employeeName} className="flex-shrink-0 w-44">
              <div className="bg-background border-2 border-dashed border-border rounded-lg p-2.5 text-sm">
                <p className="font-semibold truncate text-sm leading-tight">{emp.employeeName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{emp.jobTitle}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">not yet tracked</p>
              </div>
            </div>
          ))}

          {rosterEntries.length === 0 && untracked.length === 0 && (
            <div className="flex-shrink-0 w-48 border-2 border-dashed border-border rounded-lg flex items-center justify-center py-4 text-xs text-muted-foreground">
              Upload a performance CSV to populate
            </div>
          )}
        </div>
      </div>

      {/* Stage columns */}
      <div className="flex gap-3 flex-1 min-h-0 overflow-x-auto pb-1">
        {STAGE_ORDER.map((stage) => {
          const cfg = STAGE_CONFIG[stage]
          const stageEntries = filtered.filter((e) => e.currentStage === stage)
          const isOver = dragOver === stage

          return (
            <div
              key={stage}
              className={cn(
                'flex-1 min-w-[200px] flex flex-col rounded-xl border-2 overflow-hidden transition-colors',
                cfg.border,
                isOver ? 'ring-2 ring-primary ring-offset-1' : ''
              )}
              onDragOver={(e) => handleDragOver(e, stage)}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, stage)}
            >
              {/* Column header */}
              <div className={cn('px-3 py-2.5 border-b-2', cfg.border, cfg.headerBg)}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">{cfg.label}</span>
                  <span className="text-xs font-bold bg-background/70 border rounded-full px-2 py-0.5">
                    {stageEntries.length}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{cfg.desc}</p>
              </div>

              {/* Cards */}
              <div className={cn('flex-1 overflow-y-auto p-2 flex flex-col gap-2', cfg.columnBg)}>
                {stageEntries.map((entry) => (
                  <EmployeeCard
                    key={entry.id}
                    entry={entry}
                    draggable
                    onDragStart={(e) => handleDragStart(e, entry.id)}
                    onDragEnd={() => setDragOver(null)}
                    onClick={() => setSelectedEntryId(entry.id)}
                  />
                ))}
                <div className={cn(
                  'border-2 border-dashed rounded-lg text-center py-3 text-xs text-muted-foreground transition-colors',
                  isOver ? 'border-primary text-primary bg-primary/5' : 'border-border/50'
                )}>
                  {isOver ? 'Drop here' : 'drop here'}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Checklist manager (managers only) */}
      {canDirectMove && (
        <ChecklistManagerModal open={checklistOpen} onOpenChange={setChecklistOpen} />
      )}

      {/* Employee drawer */}
      <EmployeeDrawer
        entry={selectedEntry}
        onClose={() => setSelectedEntryId(null)}
        onRequestMove={handleRequestMove}
      />

      {/* Move reason modal (AM flow) */}
      {pendingMove && (() => {
        const entry = entries.find((e) => e.id === pendingMove.rosterEntryId)
        return (
          <MoveReasonModal
            open
            employeeName={entry?.employeeName ?? ''}
            fromStage={pendingMove.fromStage}
            toStage={pendingMove.toStage}
            onConfirm={handleMoveConfirm}
            onCancel={() => setPendingMove(null)}
            isLoading={moveMutation.isPending}
          />
        )
      })()}
    </div>
  )
}
