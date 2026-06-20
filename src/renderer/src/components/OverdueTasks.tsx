import { useState } from 'react'
import type { OverdueDateGroup, Task } from '../../../shared/types'
import TaskItem from './TaskItem'

interface Props {
  groups: OverdueDateGroup[]
  onToggle: (id: number, completed: boolean) => void
  onUpdate: (id: number, fields: { title?: string; notes?: string; links?: string[]; tags?: string[] }) => void
  onDelete: (id: number) => void
}

function overdueLabel(iso: string): string {
  const today = new Date()
  const date = new Date(iso + 'T00:00:00')
  const diffMs = today.setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0)
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 7) {
    return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' })
  }
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

function OverdueGroup({
  group,
  onToggle,
  onUpdate,
  onDelete
}: {
  group: OverdueDateGroup
  onToggle: Props['onToggle']
  onUpdate: Props['onUpdate']
  onDelete: Props['onDelete']
}) {
  const [open, setOpen] = useState(false)
  const count = group.tasks.length

  return (
    <div className="rounded-lg border border-rim overflow-hidden mb-2 bg-raised shadow-elev-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-hover transition-colors text-left"
      >
        {/* Indicator dot */}
        <span className="w-2 h-2 rounded-full bg-accent shrink-0" />

        <span className="flex-1 text-sm font-medium text-ink">
          {overdueLabel(group.date)}
        </span>

        <span className="text-xs font-medium text-on-accent bg-accent px-2 py-0.5 rounded-pill">
          {count}
        </span>

        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          className={`text-ghost shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-rim bg-canvas">
          {group.tasks.map((task: Task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OverdueTasks({ groups, onToggle, onUpdate, onDelete }: Props) {
  if (groups.length === 0) return null

  const totalCount = groups.reduce((sum, g) => sum + g.tasks.length, 0)

  return (
    <div className="px-4 pb-2">
      <div className="flex items-center gap-2 mb-2 mt-1">
        <span className="text-xs font-semibold text-danger uppercase tracking-wider">
          Carry-over
        </span>
        <span className="text-xs text-danger bg-danger/10 px-1.5 py-0.5 rounded-pill font-medium">
          {totalCount}
        </span>
      </div>
      {groups.map((g) => (
        <OverdueGroup
          key={g.date}
          group={g}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
