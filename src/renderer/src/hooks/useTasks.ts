import { useState, useEffect, useCallback } from 'react'
import type { Task, OverdueDateGroup, TaskDateGroup, RecurrenceSchedule } from '../../../shared/types'

export function useTasks(date: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await window.taskify.tasks.listByDate(date)
    setTasks(result)
    setLoading(false)
  }, [date])

  useEffect(() => {
    load()
    const off = window.taskify.on('tasks:refreshed', load)
    return off
  }, [load])

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
      const task = await window.taskify.tasks.add({
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
    [date]
  )

  const updateTask = useCallback(
    async (payload: Parameters<typeof window.taskify.tasks.update>[0]) => {
      const updated = await window.taskify.tasks.update(payload)
      if (updated) {
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      }
      return updated
    },
    []
  )

  const deleteTask = useCallback(async (id: number) => {
    await window.taskify.tasks.delete(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const reorderTasks = useCallback(
    async (orderedIds: number[]) => {
      setTasks((prev) => {
        const map = new Map(prev.map((t) => [t.id, t]))
        return orderedIds.map((id, i) => ({ ...map.get(id)!, sortOrder: i }))
      })
      await window.taskify.tasks.reorder({ date, orderedIds })
    },
    [date]
  )

  return { tasks, loading, addTask, updateTask, deleteTask, reorderTasks, reload: load }
}

export function useOverdueTasks(today: string) {
  const [groups, setGroups] = useState<OverdueDateGroup[]>([])

  const load = useCallback(async () => {
    const result = await window.taskify.tasks.listOverdue(today)
    setGroups(result)
  }, [today])

  useEffect(() => {
    load()
    const off = window.taskify.on('tasks:refreshed', load)
    return off
  }, [load])

  const updateTask = useCallback(
    async (payload: Parameters<typeof window.taskify.tasks.update>[0]) => {
      const updated = await window.taskify.tasks.update(payload)
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
    []
  )

  const deleteTask = useCallback(async (id: number) => {
    await window.taskify.tasks.delete(id)
    setGroups((prev) =>
      prev
        .map((g) => ({ ...g, tasks: g.tasks.filter((t) => t.id !== id) }))
        .filter((g) => g.tasks.length > 0)
    )
  }, [])

  return { groups, updateTask, deleteTask, reload: load }
}

export function useWeekHistoryTasks(today: string) {
  const [groups, setGroups] = useState<TaskDateGroup[]>([])

  const load = useCallback(async () => {
    const result = await window.taskify.tasks.listWeekHistory(today)
    setGroups(result)
  }, [today])

  useEffect(() => {
    load()
    const off = window.taskify.on('tasks:refreshed', load)
    return off
  }, [load])

  const updateTask = useCallback(
    async (payload: Parameters<typeof window.taskify.tasks.update>[0]) => {
      const updated = await window.taskify.tasks.update(payload)
      if (updated) {
        setGroups((prev) =>
          prev
            .map((g) => ({
              ...g,
              tasks: g.tasks.map((t) => (t.id === updated.id ? updated : t))
            }))
            .filter((g) => g.tasks.length > 0)
        )
      }
      return updated
    },
    []
  )

  const deleteTask = useCallback(async (id: number) => {
    await window.taskify.tasks.delete(id)
    setGroups((prev) =>
      prev
        .map((g) => ({ ...g, tasks: g.tasks.filter((t) => t.id !== id) }))
        .filter((g) => g.tasks.length > 0)
    )
  }, [])

  const pullToToday = useCallback(async (id: number) => {
    const task = await window.taskify.tasks.pullToToday(id)
    if (task) {
      setGroups((prev) =>
        prev
          .map((g) => ({ ...g, tasks: g.tasks.filter((t) => t.id !== id) }))
          .filter((g) => g.tasks.length > 0)
      )
    }
    return task
  }, [])

  return { groups, updateTask, deleteTask, pullToToday, reload: load }
}
