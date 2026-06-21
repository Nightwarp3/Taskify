/** Shared date/tag/schedule helpers ported from the renderer components. */
import type { RecurrenceSchedule } from '@shared/types'

export const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function localDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** YYYY-MM-DD offset from today (local). */
export function offsetDateString(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatLongDate(iso: string, withYear = false): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {})
  })
}

export function overdueLabel(iso: string): string {
  const today = new Date()
  const date = new Date(iso + 'T00:00:00')
  const diffDays = Math.round((today.setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0)) / 86400000)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 7) {
    return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' })
  }
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

export function extractTags(raw: string): { title: string; tags: string[] } {
  const tags: string[] = []
  const title = raw.replace(/#(\w+)/g, (_, tag) => { tags.push(tag); return '' }).trim()
  return { title, tags }
}

export function scheduleLabel(schedule: RecurrenceSchedule | null): string {
  if (!schedule) return 'Off'
  switch (schedule.type) {
    case 'daily': return 'Daily (weekdays)'
    case 'weekly': return `Weekly (${DOW_LABELS[schedule.dayOfWeek]})`
    case 'every_n_days': return `Every ${schedule.n} days`
    case 'monthly': return `Monthly (day ${schedule.dayOfMonth})`
  }
}

const TAG_PALETTE = [
  '#4CAF50', '#2196F3', '#FF9800', '#9C27B0',
  '#F44336', '#00BCD4', '#FF5722', '#607D8B'
]

export function tagColor(tag: string): string {
  let hash = 0
  for (const c of tag) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length]
}

export function parseJsonArray(raw: string | null): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) as string[] } catch { return [] }
}
