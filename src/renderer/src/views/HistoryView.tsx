import { useState } from 'react'
import { useTasks } from '../hooks/useTasks'
import TaskList from '../components/TaskList'

function isoDateLocal(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

export default function HistoryView() {
  const [date, setDate] = useState(isoDateLocal(-1))
  const { tasks, loading } = useTasks(date)

  const completed = tasks.filter((t) => t.completed).length

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-3 shrink-0 bg-raised border-b border-rim shadow-elev-1">
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            max={isoDateLocal(-1)}
            onChange={(e) => setDate(e.target.value)}
            className="bg-well border border-rim rounded-md px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent transition-colors"
          />
          <div>
            <p className="text-sm font-medium text-ink">{formatDate(date)}</p>
            {!loading && tasks.length > 0 && (
              <p className="text-xs text-ghost mt-0.5">
                {completed}/{tasks.length} completed
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pt-2">
        {loading ? (
          <div className="flex items-center justify-center h-24 text-ghost text-sm">Loading…</div>
        ) : (
          <TaskList
            tasks={tasks}
            onToggle={() => {}}
            onUpdate={() => {}}
            onDelete={() => {}}
            onReorder={() => {}}
            readonly
            emptyMessage="No tasks recorded for this day"
          />
        )}
      </div>
    </div>
  )
}
