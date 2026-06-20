import { ipcMain, BrowserWindow, Notification, dialog } from 'electron'
import fs from 'fs'
import {
  taskQueries,
  settingsQueries,
  projectQueries,
  templateQueries,
  checkInQueries,
  exportData,
  importData
} from './db'
import {
  rescheduleCheckIns,
  cancelCheckIns,
  scheduleTaskAlarm,
  cancelTaskAlarm,
  scheduleEndOfDay
} from './scheduler'
import type {
  TaskAddPayload,
  TaskUpdatePayload,
  TaskReorderPayload,
  ProjectAddPayload,
  ProjectUpdatePayload,
  TemplateAddPayload,
  TemplateUpdatePayload,
  ExportData
} from '../shared/types'

function localDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  // ── Tasks ─────────────────────────────────────────────────────────────────
  ipcMain.handle('tasks:listByDate', (_, date: string) => {
    return taskQueries.listByDate(date)
  })

  ipcMain.handle('tasks:listOverdue', (_, today: string) => {
    return taskQueries.listOverdue(today)
  })

  ipcMain.handle('tasks:listByProject', (_, projectId: number) => {
    return taskQueries.listByProject(projectId)
  })

  ipcMain.handle('tasks:add', (_, payload: TaskAddPayload) => {
    const today = localDateString()
    const { title, estimatedMinutes, scheduledTime, date, projectId, tags, backlog, templateId, schedule } = payload

    if (schedule) {
      const tmpl = templateQueries.add({ title, schedule, estimatedMinutes, projectId, tags })
      const taskDate = date ?? today
      const task = taskQueries.add(title, taskDate, {
        estimatedMinutes,
        scheduledTime,
        projectId,
        tags,
        templateId: tmpl.id
      })
      if (task.scheduledTime) scheduleTaskAlarm(task, getWindow())
      rescheduleCheckIns(getWindow())
      return task
    }

    const task = taskQueries.add(title, date ?? today, {
      estimatedMinutes,
      scheduledTime,
      projectId,
      tags,
      backlog,
      templateId
    })
    if (!backlog) {
      if (task.scheduledTime) scheduleTaskAlarm(task, getWindow())
      rescheduleCheckIns(getWindow())
    }
    return task
  })

  ipcMain.handle('tasks:update', (_, payload: TaskUpdatePayload) => {
    const { id, links, tags, scheduledTime, ...rest } = payload
    const updated = taskQueries.update(id, {
      ...rest,
      scheduledTime: scheduledTime !== undefined ? scheduledTime : undefined,
      links: links !== undefined ? JSON.stringify(links) : undefined,
      tags: tags !== undefined ? JSON.stringify(tags) : undefined
    })
    if (updated) {
      // Reschedule alarm if scheduledTime changed
      cancelTaskAlarm(id)
      if (updated.scheduledTime && !updated.completed) {
        scheduleTaskAlarm(updated, getWindow())
      }
      rescheduleCheckIns(getWindow())
    }
    return updated
  })

  ipcMain.handle('tasks:delete', (_, id: number) => {
    cancelCheckIns(id)
    cancelTaskAlarm(id)
    taskQueries.delete(id)
    rescheduleCheckIns(getWindow())
    return { ok: true }
  })

  ipcMain.handle('tasks:reorder', (_, payload: TaskReorderPayload) => {
    taskQueries.reorder(payload.date, payload.orderedIds)
    rescheduleCheckIns(getWindow())
    return { ok: true }
  })

  ipcMain.handle('tasks:pullToToday', (_, id: number) => {
    const today = localDateString()
    const task = taskQueries.pullToToday(id, today)
    if (task?.scheduledTime) scheduleTaskAlarm(task, getWindow())
    rescheduleCheckIns(getWindow())
    return task
  })

  // ── Projects ──────────────────────────────────────────────────────────────
  ipcMain.handle('projects:list', () => {
    return projectQueries.list()
  })

  ipcMain.handle('projects:add', (_, payload: ProjectAddPayload) => {
    return projectQueries.add(payload.name, payload.color, payload.description)
  })

  ipcMain.handle('projects:update', (_, payload: ProjectUpdatePayload) => {
    const { id, ...fields } = payload
    return projectQueries.update(id, fields)
  })

  ipcMain.handle('projects:archive', (_, id: number) => {
    return projectQueries.archive(id)
  })

  ipcMain.handle('projects:delete', (_, id: number) => {
    return projectQueries.delete(id)
  })

  // ── Recurring Templates ───────────────────────────────────────────────────
  ipcMain.handle('templates:list', () => {
    return templateQueries.list()
  })

  ipcMain.handle('templates:add', (_, payload: TemplateAddPayload) => {
    return templateQueries.add({
      title: payload.title,
      schedule: payload.schedule,
      estimatedMinutes: payload.estimatedMinutes,
      projectId: payload.projectId,
      tags: payload.tags
    })
  })

  ipcMain.handle('templates:update', (_, payload: TemplateUpdatePayload) => {
    const { id, tags, ...fields } = payload
    return templateQueries.update(id, {
      ...fields,
      tags: tags !== undefined ? JSON.stringify(tags) : undefined
    })
  })

  ipcMain.handle('templates:setActive', (_, { id, active }: { id: number; active: boolean }) => {
    return templateQueries.setActive(id, active)
  })

  ipcMain.handle('templates:delete', (_, id: number) => {
    return templateQueries.delete(id)
  })

  ipcMain.handle('templates:generateToday', (_, today: string) => {
    const newTasks = templateQueries.generateDueTasks(today)
    if (newTasks.length > 0) {
      getWindow()?.webContents.send('tasks:refreshed')
      rescheduleCheckIns(getWindow())
    }
    return newTasks
  })

  // ── Settings ──────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', () => {
    return settingsQueries.get()
  })

  ipcMain.handle('settings:set', (_, key: string, value: unknown) => {
    settingsQueries.set(key as never, value)
    scheduleEndOfDay(getWindow)
    return { ok: true }
  })

  // ── Import / Export ───────────────────────────────────────────────────────
  ipcMain.handle('data:export', async () => {
    const win = getWindow()
    const result = await dialog.showSaveDialog(win!, {
      title: 'Export Taskify Data',
      defaultPath: `taskify-export-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return { ok: false }
    const data = exportData()
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
    return { ok: true }
  })

  ipcMain.handle(
    'data:import',
    async (_, { mode, includeSettings }: { mode: 'replace' | 'append'; includeSettings: boolean }) => {
      const win = getWindow()
      const result = await dialog.showOpenDialog(win!, {
        title: 'Import Taskify Data',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile']
      })
      if (result.canceled || !result.filePaths[0]) return { ok: false }

      let data: ExportData
      try {
        const raw = fs.readFileSync(result.filePaths[0], 'utf-8')
        data = JSON.parse(raw) as ExportData
        if (data.app !== 'taskify') throw new Error('Not a Taskify export file')
      } catch (e) {
        return { ok: false, error: String(e) }
      }

      const imported = importData(data, mode, includeSettings)
      win?.webContents.send('tasks:refreshed')
      rescheduleCheckIns(getWindow())
      return { ok: true, imported }
    }
  )

  // ── Wizard ────────────────────────────────────────────────────────────────
  ipcMain.handle('wizard:requestNotificationPermission', () => {
    const supported = Notification.isSupported()
    if (supported) {
      new Notification({
        title: 'Taskify',
        body: 'Notifications are enabled!'
      }).show()
    }
    return { granted: supported }
  })

  // ── Check-ins (legacy channels, kept for API compatibility) ──────────────
  ipcMain.handle('checkins:schedule', (_, taskId: number) => {
    const task = taskQueries.getById(taskId)
    if (task) rescheduleCheckIns(getWindow())
    return { ok: true }
  })

  ipcMain.handle('checkins:cancel', (_, taskId: number) => {
    cancelCheckIns(taskId)
    rescheduleCheckIns(getWindow())
    return { ok: true }
  })
}
