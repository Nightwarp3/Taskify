import schedule from 'node-schedule'
import { Notification, BrowserWindow } from 'electron'
import { taskQueries, settingsQueries, checkInQueries } from './db'
import type { Task } from '../shared/types'

const activeJobs = new Map<string, schedule.Job>()

function jobKey(type: 'checkin' | 'eod', id: number | string): string {
  return `${type}:${id}`
}

export function scheduleCheckIns(task: Task, win: BrowserWindow | null): void {
  if (!task.estimatedMinutes || task.completed) return

  cancelCheckIns(task.id)

  const settings = settingsQueries.get()
  const intervalMs = settings.defaultCheckInInterval * 60 * 1000
  const now = Date.now()
  const totalMs = task.estimatedMinutes * 60 * 1000

  // Fire check-ins at each interval within the estimated window
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
    if (key.startsWith(`checkin:`) && key.includes(`:${taskId}`)) {
      job.cancel()
      activeJobs.delete(key)
    }
  }
  // cancel by iterating check_in ids for this task
  const pending = checkInQueries.pendingForTask(taskId)
  for (const ci of pending) {
    const key = jobKey('checkin', ci.id)
    const job = activeJobs.get(key)
    if (job) {
      job.cancel()
      activeJobs.delete(key)
    }
  }
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
      // Mark complete
      taskQueries.update(task.id, { completed: true })
      cancelCheckIns(task.id)
      win?.webContents.send('tasks:refreshed')
    } else if (index === 1) {
      // +15 min: schedule one more check-in 15 min from now
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

export function scheduleEndOfDay(win: BrowserWindow | null): void {
  const key = jobKey('eod', 'daily')
  activeJobs.get(key)?.cancel()

  const settings = settingsQueries.get()
  const [h, m] = settings.endOfDayTime.split(':').map(Number)

  // Fire daily at end-of-day time
  const job = schedule.scheduleJob({ hour: h, minute: m }, () => {
    const today = new Date().toISOString().slice(0, 10)
    const tasks = taskQueries.listByDate(today)
    const incomplete = tasks.filter((t) => !t.completed)

    if (incomplete.length === 0) return

    const notif = new Notification({
      title: 'Taskify — End of Day',
      body: `${incomplete.length} task${incomplete.length > 1 ? 's' : ''} still open. Time to wrap up or carry over.`,
      closeButtonText: 'Dismiss'
    })
    notif.on('click', () => {
      win?.show()
      win?.focus()
    })
    notif.show()
  })

  if (job) activeJobs.set(key, job)
}
