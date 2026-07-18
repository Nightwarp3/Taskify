import schedule from 'node-schedule'
import { Notification, BrowserWindow } from 'electron'
import { taskQueries, settingsQueries, checkInQueries } from './db'
import type { Task } from '../shared/types'

function localDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const activeJobs = new Map<string, schedule.Job>()
const alarmJobs = new Map<number, schedule.Job>()

function jobKey(type: 'checkin' | 'eod', id: number | string): string {
  return `${type}:${id}`
}

// ── Task alarms (fire once at scheduledTime) ──────────────────────────────

export function scheduleTaskAlarm(task: Task, win: BrowserWindow | null): void {
  cancelTaskAlarm(task.id)
  if (!task.scheduledTime || task.completed) return

  const [h, m] = task.scheduledTime.split(':').map(Number)
  const fireAt = new Date()
  fireAt.setHours(h, m, 0, 0)

  if (fireAt <= new Date()) return // already passed today

  const job = schedule.scheduleJob(fireAt, () => {
    const current = taskQueries.getById(task.id)
    if (!current || current.completed) return

    const notif = new Notification({
      title: 'Taskify — Task Time',
      body: `Time for: "${current.title}"`,
      closeButtonText: 'Dismiss'
    })
    notif.on('click', () => { win?.show(); win?.focus() })
    notif.show()
    alarmJobs.delete(task.id)
  })
  if (job) alarmJobs.set(task.id, job)
}

export function cancelTaskAlarm(taskId: number): void {
  const job = alarmJobs.get(taskId)
  if (job) {
    job.cancel()
    alarmJobs.delete(taskId)
  }
}

// ── Check-ins (fire at intervals for top-priority task only) ──────────────

function scheduleCheckIns(task: Task, win: BrowserWindow | null): void {
  if (!task.estimatedMinutes || task.completed) return

  const settings = settingsQueries.get()
  const intervalMs = settings.defaultCheckInInterval * 60 * 1000
  const now = Date.now()
  const totalMs = task.estimatedMinutes * 60 * 1000

  let offset = intervalMs
  while (offset < totalMs) {
    const fireAt = new Date(now + offset)
    const checkIn = checkInQueries.add(task.id, fireAt.toISOString())

    const key = jobKey('checkin', checkIn.id)
    const job = schedule.scheduleJob(fireAt, () => {
      fireCheckIn(task, checkIn.id, win)
      activeJobs.delete(key)
    })
    if (job) activeJobs.set(key, job)

    offset += intervalMs
  }
}

export function cancelCheckIns(taskId: number): void {
  for (const [key, job] of activeJobs) {
    if (key.startsWith('checkin:')) {
      job.cancel()
      activeJobs.delete(key)
    }
  }
  checkInQueries.removePendingForTask(taskId)
}

// Cancel all in-memory check-in jobs (used before rescheduling)
function cancelAllCheckInJobs(): void {
  for (const [key, job] of activeJobs) {
    if (key.startsWith('checkin:')) {
      job.cancel()
      activeJobs.delete(key)
    }
  }
  checkInQueries.removeAllPending()
}

// Reschedule check-ins so only the highest-priority incomplete task with an
// estimate gets check-ins. Call this after any task mutation (add, update,
// complete, reorder).
export function rescheduleCheckIns(win: BrowserWindow | null): void {
  cancelAllCheckInJobs()

  const today = localDateString()
  const tasks = taskQueries.listByDate(today)
  const topTask = tasks.find((t) => !t.completed && t.estimatedMinutes)
  if (topTask) scheduleCheckIns(topTask, win)
}

function fireCheckIn(task: Task, checkInId: number, win: BrowserWindow | null): void {
  const current = taskQueries.getById(task.id)
  if (!current || current.completed) return

  checkInQueries.markFired(checkInId)

  const notif = new Notification({
    title: 'Taskify Check-in',
    body: `How's "${current.title}" going?`,
    actions: [
      { type: 'button', text: 'Mark Complete' },
      { type: 'button', text: '+15 min' }
    ],
    closeButtonText: 'Dismiss'
  })

  notif.on('click', () => {
    win?.show()
    win?.focus()
  })

  notif.on('action', (_, index) => {
    if (index === 0) {
      taskQueries.update(task.id, { completed: true })
      cancelCheckIns(task.id)
      rescheduleCheckIns(win)
      win?.webContents.send('tasks:refreshed')
    } else if (index === 1) {
      const snoozeUntil = new Date(Date.now() + 15 * 60 * 1000)
      checkInQueries.snooze(checkInId, snoozeUntil.toISOString())
      const newCi = checkInQueries.add(task.id, snoozeUntil.toISOString())
      const key = jobKey('checkin', newCi.id)
      const job = schedule.scheduleJob(snoozeUntil, () => {
        fireCheckIn(task, newCi.id, win)
        activeJobs.delete(key)
      })
      if (job) activeJobs.set(key, job)
    }
  })

  notif.show()
}

// ── End-of-day reminder ───────────────────────────────────────────────────

export function scheduleEndOfDay(win: () => BrowserWindow | null): void {
  const key = jobKey('eod', 'daily')
  activeJobs.get(key)?.cancel()

  const settings = settingsQueries.get()
  const [h, m] = settings.endOfDayTime.split(':').map(Number)

  const job = schedule.scheduleJob({ hour: h, minute: m }, () => {
    const day = new Date().getDay()
    if (!settings.workDays.includes(day)) return

    const today = localDateString()
    const tasks = taskQueries.listByDate(today)
    const incomplete = tasks.filter((t) => !t.completed)

    if (incomplete.length === 0) return

    const notif = new Notification({
      title: 'Taskify — End of Day',
      body: `${incomplete.length} task${incomplete.length > 1 ? 's' : ''} still open. Time to wrap up or carry over.`,
      closeButtonText: 'Dismiss'
    })
    notif.on('click', () => {
      const w = win()
      w?.show()
      w?.focus()
    })
    notif.show()
  })

  if (job) activeJobs.set(key, job)
}
