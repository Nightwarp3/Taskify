/**
 * Mobile storage layer — async port of src/main/db.ts / src/capacitor/storage.ts.
 * Uses @react-native-async-storage/async-storage as the backing store.
 * An in-memory cache is loaded once at initStorage() and flushed back after
 * each mutation so individual operations stay cheap.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import type {
  Task,
  CheckIn,
  AppSettings,
  OverdueDateGroup,
  Project,
  RecurringTemplate,
  RecurrenceSchedule,
  ExportData,
  ImportResult
} from '@shared/types'

// ── Internal stored shapes ────────────────────────────────────────────────

interface StoredTask {
  id: number
  date: string
  title: string
  completed: boolean
  completedAt: string | null
  notes: string | null
  links: string | null
  estimatedMinutes: number | null
  scheduledTime: string | null
  sortOrder: number
  createdAt: string
  projectId: number | null
  tags: string | null
  templateId: number | null
  backlog: boolean
}

interface StoredCheckIn {
  id: number
  taskId: number
  scheduledAt: string
  firedAt: string | null
  snoozedUntil: string | null
}

interface StoreData {
  tasks: Record<number, StoredTask>
  tasksByDate: Record<string, number[]>
  checkIns: Record<number, StoredCheckIn>
  projects: Record<number, Project>
  recurringTemplates: Record<number, RecurringTemplate>
  settings: AppSettings
  sequences: { nextTaskId: number; nextCheckInId: number; nextProjectId: number; nextTemplateId: number }
}

// ── In-memory cache ───────────────────────────────────────────────────────

let cache: StoreData = {
  tasks: {},
  tasksByDate: {},
  checkIns: {},
  projects: {},
  recurringTemplates: {},
  settings: {
    endOfDayTime: '17:00',
    startOfDayTime: '09:00',
    defaultCheckInInterval: 30,
    theme: 'dark',
    wizardCompleted: false,
    mcpPort: 57391,
    mcpEnabled: false
  },
  sequences: { nextTaskId: 1, nextCheckInId: 1, nextProjectId: 1, nextTemplateId: 1 }
}

const KEYS = ['tasks', 'tasksByDate', 'checkIns', 'projects', 'recurringTemplates', 'settings', 'sequences'] as const

async function load<T>(key: string, fallback: T): Promise<T> {
  const value = await AsyncStorage.getItem(`taskify:${key}`)
  if (!value) return fallback
  try { return JSON.parse(value) as T } catch { return fallback }
}

async function save(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(`taskify:${key}`, JSON.stringify(value))
}

export async function initStorage(): Promise<void> {
  const [tasks, tasksByDate, checkIns, projects, recurringTemplates, settings, sequences] =
    await Promise.all(KEYS.map((k) => load(k, cache[k])))

  cache = { tasks, tasksByDate, checkIns, projects, recurringTemplates, settings, sequences } as StoreData
}

async function flush(...keys: (keyof StoreData)[]): Promise<void> {
  await Promise.all(keys.map((k) => save(k, cache[k])))
}

// ── Helpers ───────────────────────────────────────────────────────────────

function toTask(s: StoredTask): Task { return { ...s } }

export function isScheduledOn(schedule: RecurrenceSchedule, date: string): boolean {
  const d = new Date(date + 'T00:00:00')
  const dow = d.getDay()
  switch (schedule.type) {
    case 'daily': return dow >= 1 && dow <= 5
    case 'weekly': return dow === schedule.dayOfWeek
    case 'every_n_days': {
      const anchor = new Date(schedule.anchorDate + 'T00:00:00')
      const diff = Math.round((d.getTime() - anchor.getTime()) / 86400000)
      return diff >= 0 && diff % schedule.n === 0
    }
    case 'monthly': return d.getDate() === schedule.dayOfMonth
  }
}

// ── Task queries ──────────────────────────────────────────────────────────

export const taskQueries = {
  async listByDate(date: string): Promise<Task[]> {
    const order: number[] = cache.tasksByDate[date] ?? []
    return order.map((id) => cache.tasks[id]).filter((t) => t && !t.backlog).map(toTask)
  },

  async listOverdue(today: string): Promise<OverdueDateGroup[]> {
    const groups: OverdueDateGroup[] = []
    for (const [date, ids] of Object.entries(cache.tasksByDate)) {
      if (date >= today) continue
      const incomplete = (ids as number[])
        .map((id) => cache.tasks[id])
        .filter((t) => t && !t.completed && !t.backlog)
        .map(toTask)
      if (incomplete.length > 0) groups.push({ date, tasks: incomplete })
    }
    return groups.sort((a, b) => b.date.localeCompare(a.date))
  },

  async listByProject(projectId: number): Promise<Task[]> {
    return Object.values(cache.tasks)
      .filter((t) => t.projectId === projectId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toTask)
  },

  async add(
    title: string,
    date: string,
    opts: {
      estimatedMinutes?: number
      scheduledTime?: string
      projectId?: number | null
      tags?: string[]
      backlog?: boolean
      templateId?: number | null
    } = {}
  ): Promise<Task> {
    const id = cache.sequences.nextTaskId++
    const isBacklog = opts.backlog ?? false

    let sortOrder = 0
    if (!isBacklog) {
      const order: number[] = cache.tasksByDate[date] ?? []
      sortOrder = order.length
      cache.tasksByDate[date] = [...order, id]
    } else {
      const projectTasks = Object.values(cache.tasks).filter(
        (t) => t.projectId === opts.projectId && t.backlog
      )
      sortOrder = projectTasks.length
    }

    const task: StoredTask = {
      id, date, title,
      completed: false, completedAt: null,
      notes: null, links: null,
      estimatedMinutes: opts.estimatedMinutes ?? null,
      scheduledTime: opts.scheduledTime ?? null,
      sortOrder,
      createdAt: new Date().toISOString(),
      projectId: opts.projectId ?? null,
      tags: opts.tags ? JSON.stringify(opts.tags) : null,
      templateId: opts.templateId ?? null,
      backlog: isBacklog
    }
    cache.tasks[id] = task
    await flush('tasks', 'tasksByDate', 'sequences')
    return toTask(task)
  },

  async update(
    id: number,
    fields: Partial<{
      title: string; completed: boolean; notes: string | null; links: string | null
      estimatedMinutes: number | null; scheduledTime: string | null
      tags: string | null; projectId: number | null
    }>
  ): Promise<Task | null> {
    const existing = cache.tasks[id]
    if (!existing) return null
    const updated: StoredTask = { ...existing }
    if (fields.title !== undefined) updated.title = fields.title
    if (fields.completed !== undefined) {
      updated.completed = fields.completed
      updated.completedAt = fields.completed ? new Date().toISOString() : null
    }
    if (fields.notes !== undefined) updated.notes = fields.notes
    if (fields.links !== undefined) updated.links = fields.links
    if (fields.estimatedMinutes !== undefined) updated.estimatedMinutes = fields.estimatedMinutes
    if (fields.scheduledTime !== undefined) updated.scheduledTime = fields.scheduledTime
    if (fields.tags !== undefined) updated.tags = fields.tags
    if (fields.projectId !== undefined) updated.projectId = fields.projectId
    cache.tasks[id] = updated
    await flush('tasks')
    return toTask(updated)
  },

  async pullToToday(id: number, today: string): Promise<Task | null> {
    const existing = cache.tasks[id]
    if (!existing) return null
    const oldOrder: number[] = cache.tasksByDate[existing.date] ?? []
    cache.tasksByDate[existing.date] = oldOrder.filter((i) => i !== id)
    const newOrder: number[] = cache.tasksByDate[today] ?? []
    cache.tasksByDate[today] = [...newOrder, id]
    const updated: StoredTask = { ...existing, backlog: false, date: today, sortOrder: newOrder.length }
    cache.tasks[id] = updated
    await flush('tasks', 'tasksByDate')
    return toTask(updated)
  },

  async getById(id: number): Promise<Task | null> {
    const t = cache.tasks[id]
    return t ? toTask(t) : null
  },

  async delete(id: number): Promise<void> {
    const task = cache.tasks[id]
    if (!task) return
    if (!task.backlog) {
      const order: number[] = cache.tasksByDate[task.date] ?? []
      cache.tasksByDate[task.date] = order.filter((i) => i !== id)
    }
    delete cache.tasks[id]
    await flush('tasks', 'tasksByDate')
  },

  async reorder(date: string, orderedIds: number[]): Promise<void> {
    cache.tasksByDate[date] = orderedIds
    orderedIds.forEach((id, index) => {
      if (cache.tasks[id]) cache.tasks[id].sortOrder = index
    })
    await flush('tasks', 'tasksByDate')
  },

  async rescheduleDate(id: number, newDate: string): Promise<Task | null> {
    const existing = cache.tasks[id]
    if (!existing || existing.date === newDate) return existing ? toTask(existing) : null
    const oldOrder: number[] = cache.tasksByDate[existing.date] ?? []
    cache.tasksByDate[existing.date] = oldOrder.filter((i) => i !== id)
    const newOrder: number[] = cache.tasksByDate[newDate] ?? []
    cache.tasksByDate[newDate] = [...newOrder, id]
    const updated: StoredTask = { ...existing, date: newDate, sortOrder: newOrder.length }
    cache.tasks[id] = updated
    await flush('tasks', 'tasksByDate')
    return toTask(updated)
  },

  async getAll(): Promise<Task[]> {
    return Object.values(cache.tasks).map(toTask)
  }
}

// ── Project queries ───────────────────────────────────────────────────────

export const projectQueries = {
  async list(): Promise<Project[]> {
    return Object.values(cache.projects)
      .filter((p) => !p.archivedAt)
      .sort((a, b) => a.name.localeCompare(b.name))
  },

  async add(name: string, color: string, description?: string): Promise<Project> {
    const id = cache.sequences.nextProjectId++
    const project: Project = {
      id, name, color,
      description: description ?? null,
      createdAt: new Date().toISOString(),
      archivedAt: null
    }
    cache.projects[id] = project
    await flush('projects', 'sequences')
    return project
  },

  async update(id: number, fields: Partial<{ name: string; color: string; description: string }>): Promise<Project | null> {
    const existing = cache.projects[id]
    if (!existing) return null
    const updated: Project = { ...existing, ...fields }
    cache.projects[id] = updated
    await flush('projects')
    return updated
  },

  async archive(id: number): Promise<{ ok: boolean }> {
    const existing = cache.projects[id]
    if (!existing) return { ok: false }
    cache.projects[id] = { ...existing, archivedAt: new Date().toISOString() }
    await flush('projects')
    return { ok: true }
  },

  async delete(id: number): Promise<{ ok: boolean }> {
    if (!cache.projects[id]) return { ok: false }
    delete cache.projects[id]
    await flush('projects')
    return { ok: true }
  },

  async getById(id: number): Promise<Project | null> {
    return cache.projects[id] ?? null
  }
}

// ── Template queries ──────────────────────────────────────────────────────

export const templateQueries = {
  async list(): Promise<RecurringTemplate[]> {
    return Object.values(cache.recurringTemplates)
  },

  async getById(id: number): Promise<RecurringTemplate | null> {
    return cache.recurringTemplates[id] ?? null
  },

  async add(opts: {
    title: string
    schedule: RecurrenceSchedule
    estimatedMinutes?: number
    projectId?: number | null
    tags?: string[]
  }): Promise<RecurringTemplate> {
    const id = cache.sequences.nextTemplateId++
    const template: RecurringTemplate = {
      id,
      title: opts.title,
      estimatedMinutes: opts.estimatedMinutes ?? null,
      projectId: opts.projectId ?? null,
      tags: opts.tags ? JSON.stringify(opts.tags) : null,
      schedule: opts.schedule,
      active: true,
      lastInstanceDate: null,
      createdAt: new Date().toISOString()
    }
    cache.recurringTemplates[id] = template
    await flush('recurringTemplates', 'sequences')
    return template
  },

  async update(
    id: number,
    fields: Partial<{ title: string; schedule: RecurrenceSchedule; estimatedMinutes: number | null; projectId: number | null; tags: string | null }>
  ): Promise<RecurringTemplate | null> {
    const existing = cache.recurringTemplates[id]
    if (!existing) return null
    const updated: RecurringTemplate = { ...existing, ...fields }
    cache.recurringTemplates[id] = updated
    await flush('recurringTemplates')
    return updated
  },

  async setActive(id: number, active: boolean): Promise<RecurringTemplate | null> {
    const existing = cache.recurringTemplates[id]
    if (!existing) return null
    cache.recurringTemplates[id] = { ...existing, active }
    await flush('recurringTemplates')
    return cache.recurringTemplates[id]
  },

  async delete(id: number): Promise<{ ok: boolean }> {
    if (!cache.recurringTemplates[id]) return { ok: false }
    delete cache.recurringTemplates[id]
    await flush('recurringTemplates')
    return { ok: true }
  },

  async generateDueTasks(today: string): Promise<Task[]> {
    const templates = Object.values(cache.recurringTemplates)
    const allTasks = Object.values(cache.tasks)
    const created: Task[] = []

    for (const tmpl of templates) {
      if (!tmpl.active) continue
      if (!isScheduledOn(tmpl.schedule, today)) continue
      const hasIncomplete = allTasks.some((t) => t.templateId === tmpl.id && !t.completed)
      if (hasIncomplete) continue

      const task = await taskQueries.add(tmpl.title, today, {
        estimatedMinutes: tmpl.estimatedMinutes ?? undefined,
        projectId: tmpl.projectId,
        tags: tmpl.tags ? JSON.parse(tmpl.tags) : undefined,
        templateId: tmpl.id
      })
      cache.recurringTemplates[tmpl.id] = { ...tmpl, lastInstanceDate: today }
      created.push(task)
    }

    if (created.length > 0) await flush('recurringTemplates')
    return created
  }
}

// ── Settings queries ──────────────────────────────────────────────────────

export const settingsQueries = {
  async get(): Promise<AppSettings> {
    return { ...cache.settings }
  },

  async set(key: keyof AppSettings, value: unknown): Promise<void> {
    cache.settings = { ...cache.settings, [key]: value }
    await flush('settings')
  }
}

// ── Check-in queries ──────────────────────────────────────────────────────

export const checkInQueries = {
  async add(taskId: number, scheduledAt: string): Promise<CheckIn> {
    const id = cache.sequences.nextCheckInId++
    const ci: StoredCheckIn = { id, taskId, scheduledAt, firedAt: null, snoozedUntil: null }
    cache.checkIns[id] = ci
    await flush('checkIns', 'sequences')
    return ci
  },

  async markFired(id: number): Promise<void> {
    if (cache.checkIns[id]) cache.checkIns[id].firedAt = new Date().toISOString()
    await flush('checkIns')
  },

  async snooze(id: number, until: string): Promise<void> {
    if (cache.checkIns[id]) cache.checkIns[id].snoozedUntil = until
    await flush('checkIns')
  },

  async pendingForTask(taskId: number): Promise<CheckIn[]> {
    return Object.values(cache.checkIns)
      .filter((ci) => ci.taskId === taskId && ci.firedAt === null)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  }
}

// ── Import / Export ───────────────────────────────────────────────────────

export async function exportData(): Promise<ExportData> {
  return {
    version: '1.0',
    app: 'taskify',
    exportedAt: new Date().toISOString(),
    tasks: Object.values(cache.tasks).map(toTask),
    projects: Object.values(cache.projects),
    recurringTemplates: Object.values(cache.recurringTemplates),
    settings: { ...cache.settings }
  }
}

export async function importData(
  data: ExportData,
  mode: 'replace' | 'append',
  includeSettings: boolean
): Promise<ImportResult> {
  if (mode === 'replace') {
    cache.tasks = {}
    cache.tasksByDate = {}
    cache.projects = {}
    cache.recurringTemplates = {}

    for (const t of data.tasks) {
      cache.tasks[t.id] = t as StoredTask
      if (!t.backlog) {
        if (!cache.tasksByDate[t.date]) cache.tasksByDate[t.date] = []
        cache.tasksByDate[t.date].push(t.id)
      }
    }
    for (const p of data.projects) cache.projects[p.id] = p
    for (const t of data.recurringTemplates) cache.recurringTemplates[t.id] = t

    const maxTask = Math.max(0, ...data.tasks.map((t) => t.id))
    const maxProject = Math.max(0, ...data.projects.map((p) => p.id))
    const maxTemplate = Math.max(0, ...data.recurringTemplates.map((t) => t.id))
    cache.sequences = {
      nextTaskId: maxTask + 1,
      nextCheckInId: cache.sequences.nextCheckInId,
      nextProjectId: maxProject + 1,
      nextTemplateId: maxTemplate + 1
    }

    if (includeSettings) {
      const { wizardCompleted, mcpPort, mcpEnabled, ...rest } = data.settings
      cache.settings = { ...cache.settings, ...rest }
    }

    await flush('tasks', 'tasksByDate', 'projects', 'recurringTemplates', 'sequences', 'settings')
    return { tasks: data.tasks.length, projects: data.projects.length, templates: data.recurringTemplates.length }
  }

  // Append mode
  const offset = Math.max(0, ...Object.keys(cache.tasks).map(Number))
  for (const t of data.tasks) {
    const newId = t.id + offset
    const imported = { ...t, id: newId, templateId: t.templateId ? t.templateId + offset : null } as StoredTask
    cache.tasks[newId] = imported
    if (!t.backlog) {
      if (!cache.tasksByDate[t.date]) cache.tasksByDate[t.date] = []
      cache.tasksByDate[t.date].push(newId)
    }
  }
  cache.sequences.nextTaskId = offset + data.tasks.length + 1
  await flush('tasks', 'tasksByDate', 'sequences')
  return { tasks: data.tasks.length, projects: 0, templates: 0 }
}

// Expose cache read for notifications.ts
export function getCacheSnapshot() {
  return cache
}
