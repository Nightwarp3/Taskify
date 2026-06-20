/**
 * Capacitor bridge — installs window.taskify before React mounts.
 * Implements the same TaskifyAPI shape as src/preload/index.ts but backed
 * by Capacitor plugins instead of Electron IPC.
 */
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import type { TaskifyAPI } from '../../preload'
import {
  initStorage,
  taskQueries,
  projectQueries,
  templateQueries,
  settingsQueries,
  checkInQueries,
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
import type {
  TaskAddPayload,
  TaskUpdatePayload,
  TaskReorderPayload,
  ProjectAddPayload,
  ProjectUpdatePayload,
  TemplateAddPayload,
  TemplateUpdatePayload
} from '../../shared/types'

function localDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Simple in-process event bus replacing Electron's webContents.send
type EventCallback = (...args: unknown[]) => void
const listeners = new Map<string, EventCallback[]>()

function emit(channel: string, ...args: unknown[]): void {
  listeners.get(channel)?.forEach((fn) => fn(...args))
}

export async function installBridge(): Promise<void> {
  await initStorage()
  await registerNotificationTypes()

  // Re-schedule alarms for today's tasks that have a scheduled time
  const today = localDateString()
  const todayTasks = await taskQueries.listByDate(today)
  for (const task of todayTasks) {
    if (task.scheduledTime && !task.completed) await scheduleTaskAlarm(task)
  }
  await rescheduleCheckIns()

  // Schedule end-of-day based on current settings
  const settings = await settingsQueries.get()
  await scheduleEndOfDay(settings)

  // Generate recurring tasks for today
  const newTasks = await templateQueries.generateDueTasks(today)
  if (newTasks.length > 0) emit('tasks:refreshed')

  // Hook notification tap actions into the bridge
  registerNotificationListeners(() => emit('tasks:refreshed'))

  const api: TaskifyAPI = {
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
          if (task.scheduledTime) await scheduleTaskAlarm(task)
          await rescheduleCheckIns()
          return task
        }

        const task = await taskQueries.add(title, date ?? today, {
          estimatedMinutes, scheduledTime, projectId, tags, backlog, templateId
        })
        if (!backlog) {
          if (task.scheduledTime) await scheduleTaskAlarm(task)
          await rescheduleCheckIns()
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
          await cancelTaskAlarm(id)
          if (updated.scheduledTime && !updated.completed) await scheduleTaskAlarm(updated)
          await rescheduleCheckIns()
        }
        return updated
      },

      delete: async (id) => {
        await cancelTaskAlarm(id)
        await taskQueries.delete(id)
        await rescheduleCheckIns()
      },

      reorder: async (payload: TaskReorderPayload) => {
        await taskQueries.reorder(payload.date, payload.orderedIds)
        await rescheduleCheckIns()
      },

      pullToToday: async (id) => {
        const today = localDateString()
        const task = await taskQueries.pullToToday(id, today)
        if (task?.scheduledTime) await scheduleTaskAlarm(task)
        await rescheduleCheckIns()
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
        // Reschedule EOD if time settings changed
        if (key === 'endOfDayTime' || key === 'startOfDayTime') {
          const s = await settingsQueries.get()
          await scheduleEndOfDay(s)
        }
      }
    },

    data: {
      export: async () => {
        try {
          const data = await exportData()
          const json = JSON.stringify(data, null, 2)
          const filename = `taskify-export-${localDateString()}.json`

          await Filesystem.writeFile({
            path: filename,
            data: json,
            directory: Directory.Cache,
            encoding: Encoding.UTF8
          })
          const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache })

          await Share.share({
            title: 'Taskify Export',
            text: 'Taskify data export',
            url: uri,
            dialogTitle: 'Save or share your Taskify data'
          })
          return { ok: true }
        } catch {
          return { ok: false }
        }
      },

      import: async ({ mode, includeSettings }) => {
        // On mobile, the renderer uses a hidden <input type="file"> and sends
        // the parsed JSON through this bridge call with the data pre-attached.
        // See bridge note in SettingsView — this path is handled in the UI layer.
        return { ok: false, error: 'Use the file picker in Settings to import.' }
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

  ;(window as unknown as { taskify: TaskifyAPI }).taskify = api
}
