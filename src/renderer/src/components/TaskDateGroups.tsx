import { useEffect, useMemo, useState } from 'react'
import type { Task, TaskDateGroup } from '../../../shared/types'
import TaskItem from './TaskItem'

interface Props {
  title?: string
  groups: TaskDateGroup[]
  onToggle: (id: number, completed: boolean) => void
  onUpdate: (id: number, fields: { title?: string; notes?: string; links?: string[]; tags?: string[] }) => void
  onDelete?: (id: number) => void
  onPullToToday?: (id: number) => void
  readonly?: boolean
  emptyMessage?: string
  collapseWhenNoIncomplete?: boolean
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  })
}

function groupDefaults(group: TaskDateGroup) {
  const hasIncomplete = group.tasks.some((t) => !t.completed)
  return {
    dayOpen: hasIncomplete,
    incompleteOpen: hasIncomplete,
    completeOpen: false
  }
}

function TaskSection({
  tasks,
  onToggle,
  onUpdate,
  onDelete,
  onPullToToday,
  readonly
}: {
  tasks: Task[]
  onToggle: Props['onToggle']
  onUpdate: Props['onUpdate']
  onDelete?: Props['onDelete']
  onPullToToday?: Props['onPullToToday']
  readonly?: boolean
}) {
  return (
    <>
      {tasks.map((task) => (
        <div key={task.id}>
          <TaskItem
            task={task}
            onToggle={onToggle}
            onUpdate={onUpdate}
            onDelete={onDelete ?? (() => {})}
            readonly={readonly}
          />
          {!task.completed && onPullToToday && (
            <div className="pl-10 pr-3 pb-2 -mt-1">
              <button
                type="button"
                onClick={() => onPullToToday(task.id)}
                className="text-xs font-medium text-accent hover:text-accent/80 transition-colors"
              >
                Move to today
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  )
}

function TaskDatePanel(props: Props & { group: TaskDateGroup }) {
  const { group, onToggle, onUpdate, onDelete, onPullToToday, readonly, collapseWhenNoIncomplete = true } = props
  const defaults = useMemo(() => groupDefaults(group), [group])
  const [dayOpen, setDayOpen] = useState(defaults.dayOpen)
  const [incompleteOpen, setIncompleteOpen] = useState(defaults.incompleteOpen)
  const [completeOpen, setCompleteOpen] = useState(defaults.completeOpen)
  const incomplete = group.tasks.filter((t) => !t.completed)
  const complete = group.tasks.filter((t) => t.completed)

  useEffect(() => {
    if (collapseWhenNoIncomplete && incomplete.length === 0) {
      setIncompleteOpen(false)
      setDayOpen(false)
    }
  }, [collapseWhenNoIncomplete, incomplete.length])

  return (
    <div className="rounded-lg border border-rim overflow-hidden mb-2 bg-raised shadow-elev-1">
      <button
        type="button"
        onClick={() => {
          setDayOpen((v) => !v)
          setIncompleteOpen(defaults.incompleteOpen)
          setCompleteOpen(defaults.completeOpen)
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-hover transition-colors text-left"
        aria-expanded={dayOpen}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${incomplete.length > 0 ? 'bg-accent' : 'bg-ghost/50'}`} />
        <span className="flex-1 text-sm font-medium text-ink">{formatDate(group.date)}</span>
        <span className="text-xs font-medium text-on-accent bg-accent px-2 py-0.5 rounded-pill" title="Incomplete tasks">
          {incomplete.length}
        </span>
        <span className="text-xs font-medium text-muted bg-well px-2 py-0.5 rounded-pill" title="Completed tasks">
          {complete.length}
        </span>
        <span className={`text-ghost shrink-0 transition-transform duration-150 ${dayOpen ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {dayOpen && (
        <div className="border-t border-rim bg-canvas">
          {incomplete.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setIncompleteOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted hover:bg-hover"
                aria-expanded={incompleteOpen}
              >
                <span className="flex-1">Incomplete</span>
                <span>{incomplete.length}</span>
                <span>{incompleteOpen ? '▴' : '▾'}</span>
              </button>
              {incompleteOpen && (
                <TaskSection
                  tasks={incomplete}
                  onToggle={onToggle}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onPullToToday={onPullToToday}
                  readonly={readonly}
                />
              )}
            </div>
          )}

          {complete.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setCompleteOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted hover:bg-hover"
                aria-expanded={completeOpen}
              >
                <span className="flex-1">Done</span>
                <span>{complete.length}</span>
                <span>{completeOpen ? '▴' : '▾'}</span>
              </button>
              {completeOpen && (
                <TaskSection
                  tasks={complete}
                  onToggle={onToggle}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  readonly={readonly}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TaskDateGroups({ title, groups, emptyMessage, ...rest }: Props) {
  if (groups.length === 0) {
    return emptyMessage ? (
      <div className="flex items-center justify-center h-24 text-ghost text-sm">{emptyMessage}</div>
    ) : null
  }

  const incompleteTotal = groups.reduce((sum, group) => sum + group.tasks.filter((task) => !task.completed).length, 0)

  return (
    <div className="px-4 pb-2">
      {title && (
        <div className="flex items-center gap-2 mb-2 mt-1">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">{title}</span>
          <span className="text-xs text-muted bg-well px-1.5 py-0.5 rounded-pill font-medium">
            {incompleteTotal}
          </span>
        </div>
      )}
      {groups.map((group) => (
        <TaskDatePanel key={group.date} group={group} {...rest} />
      ))}
    </div>
  )
}
