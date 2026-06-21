/**
 * Assembles the TaskifyAPI object — the same shape the desktop renderer's
 * window.taskify exposes (src/preload/index.ts) — backed by the mobile
 * storage / notifications / files modules. Screens and hooks consume this via
 * TaskifyProvider instead of a contextBridge global.
 */
import type {
  Task,
  AppSettings,
  OverdueDateGroup,
  Project,
  RecurringTemplate,
  ImportResult,
  TaskAddPayload,
  TaskUpdatePayload,
  TaskReorderPayload,
  ProjectAddPayload,
  ProjectUpdatePayload,
  TemplateAddPayload,
  TemplateUpdatePayload
} from '@shared/types'
import {
  initStorage,
  taskQueries,
  projectQueries,
  templateQueries,
  settingsQueries,
  exportData,
  importData
} from './storage'
import {
  scheduleTaskAlarm,
  cancelTaskAlarm,
  rescheduleCheckIns,
  scheduleEndOfDay,
  requestNotificationPermission,
  registerNotificationListeners,
  registerNotificationTypes
} from './notifications'
import { exportToFile, pickImportFile } from './files'

export interface TaskifyAPI {
  tasks: {
    listByDate(date: string): Promise<Task[]>
    listOverdue(today: string): Promise<OverdueDateGroup[]>
    listByProject(projectId: number): Promise<Task[]>
    add(payload: TaskAddPayload): Promise<Task>
    update(payload: TaskUpdatePayload): Promise<Task | null>
    delete(id: number): Promise<void>
    reorder(payload: TaskReorderPayload): Promise<void>
    pullToToday(id: number): Promise<Task | null>
  }
  projects: {
    list(): Promise<Project[]>
    add(payload: ProjectAddPayload): Promise<Project>
    update(payload: ProjectUpdatePayload): Promise<Project | null>
    archive(id: number): Promise<{ ok: boolean }>
    delete(id: number): Promise<{ ok: boolean }>
  }
  templates: {
    list(): Promise<RecurringTemplate[]>
    add(payload: TemplateAddPayload): Promise<RecurringTemplate>
    update(payload: TemplateUpdatePayload): Promise<RecurringTemplate | null>
    setActive(id: number, active: boolean): Promise<RecurringTemplate | null>
    delete(id: number): Promise<{ ok: boolean }>
    generateToday(today: string): Promise<Task[]>
  }
  settings: {
    get(): Promise<AppSettings>
    set(key: keyof AppSettings, value: unknown): Promise<void>
  }
  data: {
    export(): Promise<{ ok: boolean }>
    import(opts: {
      mode: 'replace' | 'append'
      includeSettings: boolean
    }): Promise<{ ok: boolean; imported?: ImportResult; error?: string }>
  }
  wizard: {
    requestNotificationPermission(): Promise<{ granted: boolean }>
  }
  on(channel: string, fn: (...args: unknown[]) => void): () => void
}

function localDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── In-process event bus (replaces Electron's webContents.send) ────────────
type EventCallback = (...args: unknown[]) => void
const listeners = new Map<string, EventCallback[]>()

function emit(channel: string, ...args: unknown[]): void {
  listeners.get(channel)?.forEach((fn) => fn(...args))
}

export const taskify: TaskifyAPI = {
  tasks: {
    listByDate: (date) => taskQueries.listByDate(date),
    listOverdue: (today) => taskQueries.listOverdue(today),
    listByProject: (projectId) => taskQueries.listByProject(projectId),

    add: async (payload: TaskAddPayload) => {
      const today = localDateString()
      const { title, estimatedMinutes, scheduledTime, date, projectId, tags, backlog, templateId, schedule } = payload

      if (schedule) {
        const tmpl = await templateQueries.add({ title, schedule, estimatedMinutes, projectId, tags })
        const task = await taskQueries.add(title, date ?? today, {
          estimatedMinutes, scheduledTime, projectId, tags, templateId: tmpl.id
        })
        try { if (task.scheduledTime) await scheduleTaskAlarm(task); await rescheduleCheckIns() } catch {}
        return task
      }

      const task = await taskQueries.add(title, date ?? today, {
        estimatedMinutes, scheduledTime, projectId, tags, backlog, templateId
      })
      if (!backlog) {
        try { if (task.scheduledTime) await scheduleTaskAlarm(task); await rescheduleCheckIns() } catch {}
      }
      return task
    },

    update: async (payload: TaskUpdatePayload) => {
      const { id, links, tags, scheduledTime, ...rest } = payload
      const updated = await taskQueries.update(id, {
        ...rest,
        scheduledTime: scheduledTime !== undefined ? scheduledTime : undefined,
        links: links !== undefined ? JSON.stringify(links) : undefined,
        tags: tags !== undefined ? JSON.stringify(tags) : undefined
      })
      if (updated) {
        try {
          await cancelTaskAlarm(id)
          if (updated.scheduledTime && !updated.completed) await scheduleTaskAlarm(updated)
          await rescheduleCheckIns()
        } catch {}
      }
      return updated
    },

    delete: async (id) => {
      try { await cancelTaskAlarm(id) } catch {}
      await taskQueries.delete(id)
      try { await rescheduleCheckIns() } catch {}
    },

    reorder: async (payload: TaskReorderPayload) => {
      await taskQueries.reorder(payload.date, payload.orderedIds)
      try { await rescheduleCheckIns() } catch {}
    },

    pullToToday: async (id) => {
      const today = localDateString()
      const task = await taskQueries.pullToToday(id, today)
      try { if (task?.scheduledTime) await scheduleTaskAlarm(task); await rescheduleCheckIns() } catch {}
      return task
    }
  },

  projects: {
    list: () => projectQueries.list(),
    add: (payload: ProjectAddPayload) => projectQueries.add(payload.name, payload.color, payload.description),
    update: (payload: ProjectUpdatePayload) => {
      const { id, ...fields } = payload
      return projectQueries.update(id, fields)
    },
    archive: (id) => projectQueries.archive(id),
    delete: (id) => projectQueries.delete(id)
  },

  templates: {
    list: () => templateQueries.list(),
    add: (payload: TemplateAddPayload) => templateQueries.add(payload),
    update: (payload: TemplateUpdatePayload) => {
      const { id, tags, ...fields } = payload
      return templateQueries.update(id, {
        ...fields,
        tags: tags !== undefined ? JSON.stringify(tags) : undefined
      })
    },
    setActive: (id, active) => templateQueries.setActive(id, active),
    delete: (id) => templateQueries.delete(id),
    generateToday: async (today) => {
      const newTasks = await templateQueries.generateDueTasks(today)
      if (newTasks.length > 0) emit('tasks:refreshed')
      return newTasks
    }
  },

  settings: {
    get: () => settingsQueries.get(),
    set: async (key, value) => {
      await settingsQueries.set(key, value)
      if (key === 'theme') {
        // Native status/nav bar sync is handled by TaskifyProvider.
        emit('theme:changed', value)
      }
      if (key === 'endOfDayTime' || key === 'startOfDayTime') {
        try {
          const s = await settingsQueries.get()
          await scheduleEndOfDay(s)
        } catch (e) {
          console.warn('[Taskify] scheduleEndOfDay deferred (no permission yet):', e)
        }
      }
    }
  },

  data: {
    export: async () => {
      const data = await exportData()
      return exportToFile(data)
    },
    import: async ({ mode, includeSettings }) => {
      try {
        const data = await pickImportFile()
        if (!data) return { ok: false, error: 'No file selected.' }
        const imported = await importData(data, mode, includeSettings)
        emit('tasks:refreshed')
        return { ok: true, imported }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Import failed.' }
      }
    }
  },

  wizard: {
    requestNotificationPermission: () => requestNotificationPermission()
  },

  on: (channel, fn) => {
    const existing = listeners.get(channel) ?? []
    existing.push(fn as EventCallback)
    listeners.set(channel, existing)
    return () => {
      const updated = listeners.get(channel)?.filter((f) => f !== fn) ?? []
      listeners.set(channel, updated)
    }
  }
}

/**
 * One-time startup: load storage, register notification types/listeners,
 * schedule today's alarms/check-ins/EOD, and generate due recurring tasks.
 * Mirrors src/capacitor/bridge.ts installBridge() (minus the system-bar sync,
 * which the provider owns). Storage init is critical; notification setup is
 * best-effort so the app still launches without permissions.
 */
export async function initTaskify(): Promise<void> {
  await initStorage()

  try {
    await registerNotificationTypes()

    const today = localDateString()
    const todayTasks = await taskQueries.listByDate(today)
    for (const task of todayTasks) {
      if (task.scheduledTime && !task.completed) await scheduleTaskAlarm(task)
    }
    await rescheduleCheckIns()

    const settings = await settingsQueries.get()
    await scheduleEndOfDay(settings)

    registerNotificationListeners(() => emit('tasks:refreshed'))
  } catch (e) {
    console.warn('[Taskify] notification init failed (non-fatal):', e)
  }

  try {
    const today = localDateString()
    const newTasks = await templateQueries.generateDueTasks(today)
    if (newTasks.length > 0) emit('tasks:refreshed')
  } catch (e) {
    console.warn('[Taskify] recurring task generation failed (non-fatal):', e)
  }
}

/** Regenerate recurring tasks on app resume (replaces the desktop focus listener). */
export async function regenerateOnResume(): Promise<void> {
  try {
    const newTasks = await templateQueries.generateDueTasks(localDateString())
    if (newTasks.length > 0) emit('tasks:refreshed')
  } catch { /* best-effort */ }
}
