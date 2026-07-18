import { useMemo, useState } from 'react'
import { useHistoryRangeTasks } from '../hooks/useTasks'
import TaskDateGroups from '../components/TaskDateGroups'
import type { Task } from '../../../shared/types'

function isoDateLocal(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function taskSearchText(task: Task): string {
  const parts = [task.title, task.notes ?? '', task.links ?? '', task.tags ?? '']
  return parts.join(' ').toLowerCase()
}

export default function HistoryView() {
  const yesterday = isoDateLocal(-1)
  const [startDate, setStartDate] = useState(isoDateLocal(-30))
  const [endDate, setEndDate] = useState(yesterday)
  const [status, setStatus] = useState<'all' | 'incomplete' | 'complete'>('all')
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const { groups, loading, updateTask, deleteTask, pullToToday } = useHistoryRangeTasks(startDate, endDate)

  const filteredGroups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return groups
      .map((group) => ({
        ...group,
        tasks: group.tasks.filter((task) => {
          if (status === 'incomplete' && task.completed) return false
          if (status === 'complete' && !task.completed) return false
          if (needle && !taskSearchText(task).includes(needle)) return false
          return true
        })
      }))
      .filter((group) => group.tasks.length > 0)
  }, [groups, query, status])

  const completed = filteredGroups.reduce((sum, group) => sum + group.tasks.filter((task) => task.completed).length, 0)
  const total = filteredGroups.reduce((sum, group) => sum + group.tasks.length, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-3 shrink-0 bg-raised border-b border-rim shadow-elev-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            title="Filters"
            className={`w-8 h-8 flex items-center justify-center rounded-md border transition-colors ${
              showFilters ? 'border-accent text-accent bg-accent/10' : 'border-rim text-muted hover:bg-well'
            }`}
          >
            ⚲
          </button>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search history"
            className="min-w-0 flex-1 bg-well border border-rim rounded-md px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent transition-colors"
          />
          <div className="text-right">
            <p className="text-sm font-medium text-ink">History</p>
            {!loading && total > 0 && (
              <p className="text-xs text-ghost mt-0.5">{completed}/{total} completed</p>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-well border border-rim rounded-md px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent transition-colors"
            />
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={yesterday}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-well border border-rim rounded-md px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent transition-colors"
            />
            <div className="flex rounded-pill border border-rim overflow-hidden text-xs font-medium">
              {(['all', 'incomplete', 'complete'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatus(option)}
                  className={`px-3 py-1.5 transition-colors capitalize ${
                    status === option ? 'bg-accent text-on-accent' : 'text-muted hover:text-ink hover:bg-well'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pt-2">
        {loading ? (
          <div className="flex items-center justify-center h-24 text-ghost text-sm">Loading…</div>
        ) : (
          <TaskDateGroups
            groups={filteredGroups}
            onToggle={(id, completed) => updateTask({ id, completed })}
            onUpdate={(id, fields) => updateTask({ id, ...fields })}
            onDelete={deleteTask}
            onPullToToday={pullToToday}
            emptyMessage="No tasks found in this range"
          />
        )}
      </div>
    </div>
  )
}
