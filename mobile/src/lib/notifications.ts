/**
 * Mobile notification layer — port of src/main/scheduler.ts /
 * src/capacitor/notifications.ts. Uses expo-notifications instead of
 * node-schedule / @capacitor/local-notifications.
 *
 * expo-notifications keys scheduled notifications by string identifier, so the
 * Capacitor numeric ID ranges become string prefixes:
 *   alarm-<taskId>   task alarms
 *   checkin-<index>  check-in notifications
 *   eod              end-of-day reminder
 */
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { taskQueries, settingsQueries } from './storage'
import type { Task, AppSettings } from '@shared/types'

const ALARM_PREFIX = 'alarm-'
const CHECKIN_PREFIX = 'checkin-'
const EOD_ID = 'eod'
const CHECKIN_CATEGORY = 'CHECKIN'
const ANDROID_CHANNEL = 'default'

// Show notifications even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
})

async function cancel(identifier: string): Promise<void> {
  try { await Notifications.cancelScheduledNotificationAsync(identifier) } catch { /* ignore */ }
}

function androidChannel() {
  return Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : {}
}

// ── Task alarms (fire once at scheduledTime) ──────────────────────────────

export async function scheduleTaskAlarm(task: Task): Promise<void> {
  await cancelTaskAlarm(task.id)
  if (!task.scheduledTime || task.completed) return

  const [h, m] = task.scheduledTime.split(':').map(Number)
  const fireAt = new Date()
  fireAt.setHours(h, m, 0, 0)
  if (fireAt <= new Date()) return

  await Notifications.scheduleNotificationAsync({
    identifier: ALARM_PREFIX + task.id,
    content: {
      title: 'Taskify — Task Time',
      body: `Time for: "${task.title}"`,
      data: { taskId: task.id, type: 'alarm' }
    },
    trigger: { date: fireAt, ...androidChannel() }
  })
}

export async function cancelTaskAlarm(taskId: number): Promise<void> {
  await cancel(ALARM_PREFIX + taskId)
}

// ── Check-ins (fire at intervals for top-priority incomplete task) ─────────

export async function rescheduleCheckIns(): Promise<void> {
  // Cancel only the check-in notifications that are actually pending.
  try {
    const pending = await Notifications.getAllScheduledNotificationsAsync()
    await Promise.all(
      pending
        .filter((n) => n.identifier.startsWith(CHECKIN_PREFIX))
        .map((n) => cancel(n.identifier))
    )
  } catch { /* ignore */ }

  const today = localDateString()
  const tasks = await taskQueries.listByDate(today)
  const topTask = tasks.find((t) => !t.completed && t.estimatedMinutes)
  if (!topTask) return

  const settings = await settingsQueries.get()
  const intervalMs = settings.defaultCheckInInterval * 60 * 1000
  const totalMs = topTask.estimatedMinutes! * 60 * 1000

  let offset = intervalMs
  let notifIndex = 0
  const scheduled: Promise<string>[] = []
  while (offset < totalMs) {
    const fireAt = new Date(Date.now() + offset)
    scheduled.push(
      Notifications.scheduleNotificationAsync({
        identifier: `${CHECKIN_PREFIX}${notifIndex}`,
        content: {
          title: 'Taskify Check-in',
          body: `How's "${topTask.title}" going?`,
          categoryIdentifier: CHECKIN_CATEGORY,
          data: { taskId: topTask.id, type: 'checkin' }
        },
        trigger: { date: fireAt, ...androidChannel() }
      })
    )
    offset += intervalMs
    notifIndex++
  }
  await Promise.all(scheduled)
}

// ── End-of-day reminder ───────────────────────────────────────────────────

export async function scheduleEndOfDay(settings: AppSettings): Promise<void> {
  await cancel(EOD_ID)

  const [h, m] = settings.endOfDayTime.split(':').map(Number)
  await Notifications.scheduleNotificationAsync({
    identifier: EOD_ID,
    content: {
      title: 'Taskify — End of Day',
      body: 'Time to wrap up or carry over your open tasks.',
      data: { type: 'eod' }
    },
    // Daily repeating trigger at the configured hour/minute.
    trigger: { hour: h, minute: m, repeats: true, ...androidChannel() }
  })
}

// ── Handle notification tap actions ──────────────────────────────────────

let responseSub: Notifications.Subscription | null = null

export function registerNotificationListeners(onRefresh: () => void): void {
  responseSub?.remove()
  responseSub = Notifications.addNotificationResponseReceivedListener(async (response) => {
    const extra = response.notification.request.content.data as { taskId?: number; type?: string }

    if (extra?.type === 'checkin' && extra.taskId) {
      if (response.actionIdentifier === 'COMPLETE') {
        await taskQueries.update(extra.taskId, { completed: true })
        await rescheduleCheckIns()
        onRefresh()
      } else if (response.actionIdentifier === 'SNOOZE') {
        // +15 min: reschedule one more check-in.
        const task = await taskQueries.getById(extra.taskId)
        if (task && !task.completed) {
          const snoozeAt = new Date(Date.now() + 15 * 60 * 1000)
          await Notifications.scheduleNotificationAsync({
            identifier: `${CHECKIN_PREFIX}snooze-${Date.now()}`,
            content: {
              title: 'Taskify Check-in',
              body: `How's "${task.title}" going?`,
              categoryIdentifier: CHECKIN_CATEGORY,
              data: { taskId: extra.taskId, type: 'checkin' }
            },
            trigger: { date: snoozeAt, ...androidChannel() }
          })
        }
      }
    }
  })
}

// ── Register notification action types / channel ─────────────────────────

export async function registerNotificationTypes(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: 'Taskify',
      importance: Notifications.AndroidImportance.HIGH
    })
  }
  await Notifications.setNotificationCategoryAsync(CHECKIN_CATEGORY, [
    { identifier: 'COMPLETE', buttonTitle: 'Mark Complete' },
    { identifier: 'SNOOZE', buttonTitle: '+15 min' }
  ])
}

// ── Request permission ────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<{ granted: boolean }> {
  const { granted } = await Notifications.requestPermissionsAsync()
  return { granted }
}

function localDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
