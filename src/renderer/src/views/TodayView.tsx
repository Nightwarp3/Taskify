import { useState, useMemo } from 'react'
import { useTasks, useOverdueTasks } from '../hooks/useTasks'
import AddTaskBar from '../components/AddTaskBar'
import TaskList from '../components/TaskList'
import OverdueTasks from '../components/OverdueTasks'
import type { RecurrenceSchedule } from '../../../shared/types'

const today = new Date().toISOString().slice(0, 10)

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
}

interface Props {
  onNavigateToTemplate?: (templateId: number) => void
}

export default function TodayView({ onNavigateToTemplate }: Props) {
  const { tasks, loading, addTask, updateTask, deleteTask, reorderTasks } = useTasks(today)
  const { groups, updateTask: updateOverdue, deleteTask: deleteOverdue } = useOverdueTasks(today)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const t of tasks) {
      if (t.tags) {
        try {
          const parsed = JSON.parse(t.tags) as string[]
          parsed.forEach((tag) => tagSet.add(tag))
        } catch { /* ignore */ }
      }
    }
    return Array.from(tagSet).sort()
  }, [tasks])

  const handleAdd = (
    title: string,
    opts?: {
      estimatedMinutes?: number
      tags?: string[]
      projectId?: number | null
      schedule?: RecurrenceSchedule
    }
  ) => {
    addTask(title, opts)
  }

  const handleToggle = (id: number, completed: boolean) => updateTask({ id, completed })
  const handleUpdate = (id: number, fields: { title?: string; notes?: string; links?: string[]; tags?: string[] }) =>
    updateTask({ id, ...fields })
  const handleOverdueToggle = (id: number, completed: boolean) => updateOverdue({ id, completed })
  const handleOverdueUpdate = (id: number, fields: { title?: string; notes?: string; links?: string[]; tags?: string[] }) =>
    updateOverdue({ id, ...fields })

  const filteredTasks = useMemo(() => {
    if (!activeFilter) return tasks
    return tasks.filter((t) => {
      if (!t.tags) return false
      try { return (JSON.parse(t.tags) as string[]).includes(activeFilter) }
      catch { return false }
    })
  }, [tasks, activeFilter])

  const incomplete = filteredTasks.filter((t) => !t.completed).length

  return (
    <div className="flex flex-col h-full">
      {/* Date header */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <p className="text-xs font-medium text-muted">{formatDate(today)}</p>
        {!loading && tasks.length > 0 && (
          <p className="text-xs text-ghost mt-0.5">
            {incomplete} remaining · {tasks.filter((t) => t.completed).length} done
          </p>
        )}
      </div>

      {/* Add bar */}
      <AddTaskBar onAdd={handleAdd} />

      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="px-4 pb-2 shrink-0 flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveFilter(null)}
            className={`text-xs px-2.5 py-1 rounded-pill border transition-colors ${
              !activeFilter
                ? 'border-accent text-accent bg-accent/10'
                : 'border-rim text-muted hover:border-muted'
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveFilter(activeFilter === tag ? null : tag)}
              className={`text-xs px-2.5 py-1 rounded-pill border transition-colors ${
                activeFilter === tag
                  ? 'border-accent text-accent bg-accent/10'
                  : 'border-rim text-muted hover:border-muted'
              }`}
            >
              #{tag}
            </button>
          ))}
          {activeFilter && (
            <button
              onClick={() => setActiveFilter(null)}
              className="text-xs text-ghost hover:text-muted transition-colors"
              title="Clear filter"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-24 text-ghost text-sm">Loading…</div>
        ) : (
          <>
            <div className="px-3">
              <TaskList
                tasks={filteredTasks}
                onToggle={handleToggle}
                onUpdate={handleUpdate}
                onDelete={deleteTask}
                onReorder={reorderTasks}
                onNavigateToTemplate={onNavigateToTemplate}
              />
            </div>

            {/* Carry-over from previous days */}
            {groups.length > 0 && (
              <div className="mt-2">
                <OverdueTasks
                  groups={groups}
                  onToggle={handleOverdueToggle}
                  onUpdate={handleOverdueUpdate}
                  onDelete={deleteOverdue}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
