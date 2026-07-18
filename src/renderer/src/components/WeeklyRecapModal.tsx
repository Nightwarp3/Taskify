import { useEffect, useMemo, useState } from 'react'
import type { AppSettings } from '../../../shared/types'
import { useHistoryRangeTasks } from '../hooks/useTasks'
import TaskDateGroups from './TaskDateGroups'

function localDateString(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function WeeklyRecapModal() {
  const today = localDateString()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [visibleIds, setVisibleIds] = useState<Set<number> | null>(null)
  const { groups, loading, updateTask, pullToToday } = useHistoryRangeTasks(localDateString(-7), localDateString(-1))

  useEffect(() => {
    window.taskify.settings.get().then(setSettings)
  }, [])

  const shouldShowToday = useMemo(() => {
    if (!settings || dismissed) return false
    const day = new Date(today + 'T00:00:00').getDay()
    return day === settings.startOfWeekDay && settings.weeklyRecapDismissedDate !== today
  }, [dismissed, settings, today])

  useEffect(() => {
    if (!shouldShowToday || loading || visibleIds) return
    const ids = groups
      .flatMap((group) => group.tasks)
      .filter((task) => !task.completed)
      .map((task) => task.id)
    setVisibleIds(new Set(ids))
  }, [groups, loading, shouldShowToday, visibleIds])

  const recapGroups = useMemo(() => {
    if (!visibleIds) return []
    return groups
      .map((group) => ({
        ...group,
        tasks: group.tasks.filter((task) => visibleIds.has(task.id))
      }))
      .filter((group) => group.tasks.length > 0)
  }, [groups, visibleIds])

  const dismiss = async () => {
    await window.taskify.settings.set('weeklyRecapDismissedDate', today)
    setDismissed(true)
  }

  const moveToToday = async (id: number) => {
    await pullToToday(id)
    setVisibleIds((prev) => {
      const next = new Set(prev ?? [])
      next.delete(id)
      return next
    })
  }

  const toggleRecapTask = async (id: number, completed: boolean) => {
    await updateTask({ id, completed })
    if (completed) {
      setVisibleIds((prev) => {
        const next = new Set(prev ?? [])
        next.delete(id)
        return next
      })
    }
  }

  if (!shouldShowToday || loading || !visibleIds || recapGroups.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-raised border border-rim rounded-xl shadow-elev-1 w-full max-w-lg max-h-[82vh] flex flex-col">
        <div className="px-4 py-3 border-b border-rim">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Start of week recap</h2>
              <p className="text-xs text-ghost mt-0.5">Review unfinished tasks from the last 7 days.</p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="text-xs px-3 py-1.5 bg-well hover:bg-hover border border-rim rounded-md font-medium text-ink transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
        <div className="overflow-y-auto py-2">
          <TaskDateGroups
            groups={recapGroups}
            onToggle={toggleRecapTask}
            onUpdate={(id, fields) => updateTask({ id, ...fields })}
            onPullToToday={moveToToday}
            collapseWhenNoIncomplete={false}
          />
        </div>
      </div>
    </div>
  )
}
