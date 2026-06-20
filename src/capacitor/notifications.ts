/**
 * Capacitor notification layer — port of src/main/scheduler.ts.
 * Uses @capacitor/local-notifications instead of node-schedule + Electron Notification.
 */
import { LocalNotifications } from '@capacitor/local-notifications'
import { taskQueries, settingsQueries, getCacheSnapshot } from './storage'
import type { Task, AppSettings } from '../../shared/types'

// Stable notification ID ranges to avoid collisions:
//   1–49999     task alarms (taskId)
//   50000–99999 check-in notifications (checkIn id offset)
//   100000      end-of-day
const ALARM_BASE = 0
const CHECKIN_BASE = 50000
const EOD_ID = 100000

function localDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Task alarms (fire once at scheduledTime) ──────────────────────────────

export async function scheduleTaskAlarm(task: Task): Promise<void> {
  await cancelTaskAlarm(task.id)
  if (!task.scheduledTime || task.completed) return

  const [h, m] = task.scheduledTime.split(':').map(Number)
  const fireAt = new Date()
  fireAt.setHours(h, m, 0, 0)
  if (fireAt <= new Date()) return

  await LocalNotifications.schedule({
    notifications: [{
      id: ALARM_BASE + task.id,
      title: 'Taskify — Task Time',
      body: `Time for: "${task.title}"`,
      schedule: { at: fireAt, allowWhileIdle: true },
      extra: { taskId: task.id, type: 'alarm' }
    }]
  })
}

export async function cancelTaskAlarm(taskId: number): Promise<void> {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ALARM_BASE + taskId }] })
  } catch { /* ignore if not scheduled */ }
}

// ── Check-ins (fire at intervals for top-priority incomplete task) ─────────

export async function rescheduleCheckIns(): Promise<void> {
  // Cancel all pending check-in notifications
  const pending: { id: number }[] = []
  for (let i = CHECKIN_BASE; i < CHECKIN_BASE + 10000; i++) pending.push({ id: i })
  try { await LocalNotifications.cancel({ notifications: pending }) } catch { /* ignore */ }

  const today = localDateString()
  const tasks = await taskQueries.listByDate(today)
  const topTask = tasks.find((t) => !t.completed && t.estimatedMinutes)
  if (!topTask) return

  const settings = await settingsQueries.get()
  const intervalMs = settings.defaultCheckInInterval * 60 * 1000
  const totalMs = topTask.estimatedMinutes! * 60 * 1000
  const notifications: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = []

  let offset = intervalMs
  let notifIndex = 0
  while (offset < totalMs) {
    const fireAt = new Date(Date.now() + offset)
    notifications.push({
      id: CHECKIN_BASE + notifIndex,
      title: 'Taskify Check-in',
      body: `How's "${topTask.title}" going?`,
      schedule: { at: fireAt, allowWhileIdle: true },
      actionTypeId: 'CHECKIN',
      extra: { taskId: topTask.id, type: 'checkin' }
    })
    offset += intervalMs
    notifIndex++
  }

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications })
  }
}

// ── End-of-day reminder ───────────────────────────────────────────────────

export async function scheduleEndOfDay(settings: AppSettings): Promise<void> {
  try { await LocalNotifications.cancel({ notifications: [{ id: EOD_ID }] }) } catch { /* ignore */ }

  const [h, m] = settings.endOfDayTime.split(':').map(Number)
  const fireAt = new Date()
  fireAt.setHours(h, m, 0, 0)
  // If already past today's EOD time, schedule for tomorrow
  if (fireAt <= new Date()) fireAt.setDate(fireAt.getDate() + 1)

  await LocalNotifications.schedule({
    notifications: [{
      id: EOD_ID,
      title: 'Taskify — End of Day',
      body: 'Time to wrap up or carry over your open tasks.',
      schedule: { at: fireAt, every: 'day', allowWhileIdle: true },
      extra: { type: 'eod' }
    }]
  })
}

// ── Handle notification tap actions ──────────────────────────────────────

export function registerNotificationListeners(onRefresh: () => void): void {
  LocalNotifications.addListener('localNotificationActionPerformed', async (event) => {
    const extra = event.notification.extra as { taskId?: number; type?: string }

    if (extra?.type === 'checkin' && extra.taskId) {
      if (event.actionId === 'COMPLETE') {
        await taskQueries.update(extra.taskId, { completed: true })
        await rescheduleCheckIns()
        onRefresh()
      } else if (event.actionId === 'SNOOZE') {
        // +15 min: reschedule one more check-in
        const task = await taskQueries.getById(extra.taskId)
        if (task && !task.completed) {
          const snoozeAt = new Date(Date.now() + 15 * 60 * 1000)
          const cache = getCacheSnapshot()
          const snoozeId = CHECKIN_BASE + Object.values(cache.checkIns).length
          await LocalNotifications.schedule({
            notifications: [{
              id: snoozeId,
              title: 'Taskify Check-in',
              body: `How's "${task.title}" going?`,
              schedule: { at: snoozeAt, allowWhileIdle: true },
              actionTypeId: 'CHECKIN',
              extra: { taskId: extra.taskId, type: 'checkin' }
            }]
          })
        }
      }
    }
  })
}

// ── Register notification action types ───────────────────────────────────

export async function registerNotificationTypes(): Promise<void> {
  await LocalNotifications.registerActionTypes({
    types: [{
      id: 'CHECKIN',
      actions: [
        { id: 'COMPLETE', title: 'Mark Complete' },
        { id: 'SNOOZE', title: '+15 min' }
      ]
    }]
  })
}

// ── Request permission ────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<{ granted: boolean }> {
  const { display } = await LocalNotifications.requestPermissions()
  return { granted: display === 'granted' }
}
