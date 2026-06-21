/**
 * Port of src/renderer/src/hooks/useTasks.ts. Logic is unchanged; it consumes
 * the TaskifyAPI from context instead of the window.taskify global.
 */
import { useState, useEffect, useCallback } from 'react'
import type { Task, OverdueDateGroup, RecurrenceSchedule, TaskUpdatePayload } from '@shared/types'
import { useTaskifyApi } from '../providers/TaskifyProvider'

export function useTasks(date: string) {
  const api = useTaskifyApi()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await api.tasks.listByDate(date)
    setTasks(result)
    setLoading(false)
  }, [api, date])

  useEffect(() => {
    load()
    const off = api.on('tasks:refreshed', load)
    return off
  }, [api, load])

  const addTask = useCallback(
    async (
      title: string,
      opts?: {
        estimatedMinutes?: number
        scheduledTime?: string
        tags?: string[]
        projectId?: number | null
        schedule?: RecurrenceSchedule
      }
    ) => {
      const task = await api.tasks.add({
        title,
        date,
        estimatedMinutes: opts?.estimatedMinutes,
        scheduledTime: opts?.scheduledTime,
        tags: opts?.tags,
        projectId: opts?.projectId,
        schedule: opts?.schedule
      })
      setTasks((prev) => [...prev, task])
      return task
    },
    [api, date]
  )

  const updateTask = useCallback(
    async (payload: TaskUpdatePayload) => {
      const updated = await api.tasks.update(payload)
      if (updated) {
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      }
      return updated
    },
    [api]
  )

  const deleteTask = useCallback(async (id: number) => {
    await api.tasks.delete(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [api])

  const reorderTasks = useCallback(
    async (orderedIds: number[]) => {
      setTasks((prev) => {
        const map = new Map(prev.map((t) => [t.id, t]))
        return orderedIds.map((id, i) => ({ ...map.get(id)!, sortOrder: i }))
      })
      await api.tasks.reorder({ date, orderedIds })
    },
    [api, date]
  )

  return { tasks, loading, addTask, updateTask, deleteTask, reorderTasks, reload: load }
}

export function useOverdueTasks(today: string) {
  const api = useTaskifyApi()
  const [groups, setGroups] = useState<OverdueDateGroup[]>([])

  const load = useCallback(async () => {
    const result = await api.tasks.listOverdue(today)
    setGroups(result)
  }, [api, today])

  useEffect(() => {
    load()
    const off = api.on('tasks:refreshed', load)
    return off
  }, [api, load])

  const updateTask = useCallback(
    async (payload: TaskUpdatePayload) => {
      const updated = await api.tasks.update(payload)
      if (updated) {
        setGroups((prev) =>
          prev
            .map((g) => ({
              ...g,
              tasks: g.tasks.map((t) => (t.id === updated.id ? updated : t))
            }))
            .map((g) => ({ ...g, tasks: g.tasks.filter((t) => !t.completed) }))
            .filter((g) => g.tasks.length > 0)
        )
      }
      return updated
    },
    [api]
  )

  const deleteTask = useCallback(async (id: number) => {
    await api.tasks.delete(id)
    setGroups((prev) =>
      prev
        .map((g) => ({ ...g, tasks: g.tasks.filter((t) => t.id !== id) }))
        .filter((g) => g.tasks.length > 0)
    )
  }, [api])

  const pullToToday = useCallback(async (id: number) => {
    await api.tasks.pullToToday(id)
    setGroups((prev) =>
      prev
        .map((g) => ({ ...g, tasks: g.tasks.filter((t) => t.id !== id) }))
        .filter((g) => g.tasks.length > 0)
    )
  }, [api])

  return { groups, updateTask, deleteTask, pullToToday, reload: load }
}
