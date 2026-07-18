import Store from 'electron-store'
import type {
  Task,
  CheckIn,
  AppSettings,
  OverdueDateGroup,
  TaskDateGroup,
  Project,
  RecurringTemplate,
  RecurrenceSchedule,
  ExportData,
  ImportResult
} from '../shared/types'

interface StoreSchema {
  tasks: Record<number, StoredTask>
  tasksByDate: Record<string, number[]>
  checkIns: Record<number, StoredCheckIn>
  projects: Record<number, Project>
  recurringTemplates: Record<number, RecurringTemplate>
  settings: AppSettings
  nextTaskId: number
  nextCheckInId: number
  nextProjectId: number
  nextTemplateId: number
}

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

const DEFAULT_SETTINGS: AppSettings = {
  endOfDayTime: '17:00',
  startOfDayTime: '09:00',
  defaultCheckInInterval: 30,
  theme: 'dark',
  closeBehavior: 'background',
  wizardCompleted: false,
  mcpPort: 57391,
  mcpEnabled: false
}

const store = new Store<StoreSchema>({
  defaults: {
    tasks: {},
    tasksByDate: {},
    checkIns: {},
    projects: {},
    recurringTemplates: {},
    settings: DEFAULT_SETTINGS,
    nextTaskId: 1,
    nextCheckInId: 1,
    nextProjectId: 1,
    nextTemplateId: 1
  }
})

function toTask(s: StoredTask): Task {
  return { ...s }
}

function weekStart(date: string): string {
  const d = new Date(date + 'T00:00:00')
  const day = d.getDay()
  const offset = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const taskQueries = {
  listByDate(date: string): Task[] {
    const order: number[] = store.get(`tasksByDate.${date}` as never, [] as never) as number[]
    const tasks = store.get('tasks')
    return order
      .map((id) => tasks[id])
      .filter((t) => t && !t.backlog)
      .map(toTask)
  },

  listOverdue(today: string): OverdueDateGroup[] {
    const tasksByDate = store.get('tasksByDate')
    const tasks = store.get('tasks')
    const groups: OverdueDateGroup[] = []

    for (const [date, ids] of Object.entries(tasksByDate)) {
      if (date >= today) continue
      const incompleteTasks = (ids as number[])
        .map((id) => tasks[id])
        .filter((t) => t && !t.completed && !t.backlog)
        .map(toTask)
      if (incompleteTasks.length > 0) {
        groups.push({ date, tasks: incompleteTasks })
      }
    }

    return groups.sort((a, b) => b.date.localeCompare(a.date))
  },

  listWeekHistory(today: string): TaskDateGroup[] {
    const start = weekStart(today)
    const tasksByDate = store.get('tasksByDate')
    const tasks = store.get('tasks')
    const groups: TaskDateGroup[] = []

    for (const [date, ids] of Object.entries(tasksByDate)) {
      if (date < start || date >= today) continue
      const dayTasks = (ids as number[])
        .map((id) => tasks[id])
        .filter((t) => t && !t.backlog)
        .map(toTask)
      if (dayTasks.length > 0) groups.push({ date, tasks: dayTasks })
    }

    return groups.sort((a, b) => b.date.localeCompare(a.date))
  },

  listByProject(projectId: number): Task[] {
    const tasks = store.get('tasks')
    return Object.values(tasks)
      .filter((t) => t.projectId === projectId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toTask)
  },

  add(
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
  ): Task {
    const id = store.get('nextTaskId')
    store.set('nextTaskId', id + 1)

    const isBacklog = opts.backlog ?? false

    let sortOrder = 0
    if (!isBacklog) {
      const order: number[] = store.get(`tasksByDate.${date}` as never, [] as never) as number[]
      sortOrder = order.length
      store.set(`tasksByDate.${date}` as never, [...order, id] as never)
    } else {
      const tasks = store.get('tasks')
      const projectTasks = Object.values(tasks).filter(
        (t) => t.projectId === opts.projectId && t.backlog
      )
      sortOrder = projectTasks.length
    }

    const task: StoredTask = {
      id,
      date,
      title,
      completed: false,
      completedAt: null,
      notes: null,
      links: null,
      estimatedMinutes: opts.estimatedMinutes ?? null,
      scheduledTime: opts.scheduledTime ?? null,
      sortOrder,
      createdAt: new Date().toISOString(),
      projectId: opts.projectId ?? null,
      tags: opts.tags ? JSON.stringify(opts.tags) : null,
      templateId: opts.templateId ?? null,
      backlog: isBacklog
    }

    store.set(`tasks.${id}` as never, task as never)
    return toTask(task)
  },

  update(
    id: number,
    fields: Partial<{
      title: string
      completed: boolean
      notes: string | null
      links: string | null
      estimatedMinutes: number | null
      scheduledTime: string | null
      tags: string | null
      projectId: number | null
    }>
  ): Task | null {
    const existing = store.get('tasks')[id]
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

    store.set(`tasks.${id}` as never, updated as never)
    return toTask(updated)
  },

  pullToToday(id: number, today: string): Task | null {
    const existing = store.get('tasks')[id]
    if (!existing) return null

    if (!existing.backlog) {
      const oldOrder: number[] = store.get(`tasksByDate.${existing.date}` as never, [] as never) as number[]
      store.set(`tasksByDate.${existing.date}` as never, oldOrder.filter((i) => i !== id) as never)
    }

    const updated: StoredTask = { ...existing, backlog: false, date: today }
    const order = (store.get(`tasksByDate.${today}` as never, [] as never) as number[])
      .filter((i) => i !== id)
    updated.sortOrder = order.length
    store.set(`tasks.${id}` as never, updated as never)
    store.set(`tasksByDate.${today}` as never, [...order, id] as never)
    return toTask(updated)
  },

  getById(id: number): Task | null {
    const t = store.get('tasks')[id]
    return t ? toTask(t) : null
  },

  delete(id: number): void {
    const task = store.get('tasks')[id]
    if (!task) return

    if (!task.backlog) {
      const order: number[] = store.get(`tasksByDate.${task.date}` as never, [] as never) as number[]
      store.set(`tasksByDate.${task.date}` as never, order.filter((i) => i !== id) as never)
    }

    const tasks = store.get('tasks')
    delete tasks[id]
    store.set('tasks', tasks)
  },

  reorder(date: string, orderedIds: number[]): void {
    store.set(`tasksByDate.${date}` as never, orderedIds as never)
    orderedIds.forEach((id, index) => {
      const task = store.get('tasks')[id]
      if (task) store.set(`tasks.${id}.sortOrder` as never, index as never)
    })
  },

  rescheduleDate(id: number, newDate: string): Task | null {
    const existing = store.get('tasks')[id]
    if (!existing || existing.date === newDate) return existing ? toTask(existing) : null

    const oldOrder: number[] = store.get(`tasksByDate.${existing.date}` as never, [] as never) as number[]
    store.set(`tasksByDate.${existing.date}` as never, oldOrder.filter((i) => i !== id) as never)

    const newOrder: number[] = store.get(`tasksByDate.${newDate}` as never, [] as never) as number[]
    store.set(`tasksByDate.${newDate}` as never, [...newOrder, id] as never)

    const updated: StoredTask = { ...existing, date: newDate, sortOrder: newOrder.length }
    store.set(`tasks.${id}` as never, updated as never)
    return toTask(updated)
  },

  getAll(): Task[] {
    return Object.values(store.get('tasks')).map(toTask)
  }
}

export const projectQueries = {
  list(): Project[] {
    const projects = store.get('projects')
    return Object.values(projects)
      .filter((p) => !p.archivedAt)
      .sort((a, b) => a.name.localeCompare(b.name))
  },

  listAll(): Project[] {
    return Object.values(store.get('projects'))
  },

  add(name: string, color: string, description?: string): Project {
    const id = store.get('nextProjectId')
    store.set('nextProjectId', id + 1)
    const project: Project = {
      id,
      name,
      color,
      description: description ?? null,
      createdAt: new Date().toISOString(),
      archivedAt: null
    }
    store.set(`projects.${id}` as never, project as never)
    return project
  },

  update(id: number, fields: Partial<{ name: string; color: string; description: string }>): Project | null {
    const projects = store.get('projects')
    const existing = projects[id]
    if (!existing) return null
    const updated: Project = { ...existing, ...fields }
    store.set(`projects.${id}` as never, updated as never)
    return updated
  },

  archive(id: number): { ok: boolean } {
    const existing = store.get('projects')[id]
    if (!existing) return { ok: false }
    store.set(`projects.${id}.archivedAt` as never, new Date().toISOString() as never)
    return { ok: true }
  },

  delete(id: number): { ok: boolean } {
    const projects = store.get('projects')
    if (!projects[id]) return { ok: false }
    delete projects[id]
    store.set('projects', projects)
    return { ok: true }
  },

  getById(id: number): Project | null {
    return store.get('projects')[id] ?? null
  }
}

export function isScheduledOn(schedule: RecurrenceSchedule, date: string): boolean {
  const d = new Date(date + 'T00:00:00')
  const dow = d.getDay()

  switch (schedule.type) {
    case 'daily':
      return dow >= 1 && dow <= 5

    case 'weekly':
      return dow === schedule.dayOfWeek

    case 'every_n_days': {
      const anchor = new Date(schedule.anchorDate + 'T00:00:00')
      const diff = Math.round((d.getTime() - anchor.getTime()) / 86400000)
      return diff >= 0 && diff % schedule.n === 0
    }

    case 'monthly':
      return d.getDate() === schedule.dayOfMonth
  }
}

export const templateQueries = {
  list(): RecurringTemplate[] {
    return Object.values(store.get('recurringTemplates'))
  },

  getById(id: number): RecurringTemplate | null {
    return store.get('recurringTemplates')[id] ?? null
  },

  add(opts: {
    title: string
    schedule: RecurrenceSchedule
    estimatedMinutes?: number
    projectId?: number | null
    tags?: string[]
  }): RecurringTemplate {
    const id = store.get('nextTemplateId')
    store.set('nextTemplateId', id + 1)
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
    store.set(`recurringTemplates.${id}` as never, template as never)
    return template
  },

  update(
    id: number,
    fields: Partial<{
      title: string
      schedule: RecurrenceSchedule
      estimatedMinutes: number | null
      projectId: number | null
      tags: string | null
    }>
  ): RecurringTemplate | null {
    const existing = store.get('recurringTemplates')[id]
    if (!existing) return null
    const updated: RecurringTemplate = { ...existing, ...fields }
    store.set(`recurringTemplates.${id}` as never, updated as never)
    return updated
  },

  setActive(id: number, active: boolean): RecurringTemplate | null {
    const existing = store.get('recurringTemplates')[id]
    if (!existing) return null
    const updated: RecurringTemplate = { ...existing, active }
    store.set(`recurringTemplates.${id}` as never, updated as never)
    return updated
  },

  delete(id: number): { ok: boolean } {
    const templates = store.get('recurringTemplates')
    if (!templates[id]) return { ok: false }
    delete templates[id]
    store.set('recurringTemplates', templates)
    return { ok: true }
  },

  generateDueTasks(today: string): Task[] {
    const templates = Object.values(store.get('recurringTemplates'))
    const allTasks = Object.values(store.get('tasks'))
    const created: Task[] = []

    for (const tmpl of templates) {
      if (!tmpl.active) continue
      if (!isScheduledOn(tmpl.schedule, today)) continue

      const hasIncomplete = allTasks.some(
        (t) => t.templateId === tmpl.id && !t.completed
      )
      if (hasIncomplete) continue

      const task = taskQueries.add(tmpl.title, today, {
        estimatedMinutes: tmpl.estimatedMinutes ?? undefined,
        projectId: tmpl.projectId,
        tags: tmpl.tags ? JSON.parse(tmpl.tags) : undefined,
        templateId: tmpl.id
      })

      store.set(`recurringTemplates.${tmpl.id}.lastInstanceDate` as never, today as never)
      created.push(task)
    }

    return created
  }
}

export const settingsQueries = {
  get(): AppSettings {
    return { ...DEFAULT_SETTINGS, ...store.get('settings') }
  },

  set(key: keyof AppSettings, value: unknown): void {
    store.set(`settings.${key}` as never, value as never)
  }
}

export const checkInQueries = {
  add(taskId: number, scheduledAt: string): CheckIn {
    const id = store.get('nextCheckInId')
    store.set('nextCheckInId', id + 1)

    const ci: StoredCheckIn = { id, taskId, scheduledAt, firedAt: null, snoozedUntil: null }
    store.set(`checkIns.${id}` as never, ci as never)
    return ci
  },

  markFired(id: number): void {
    store.set(`checkIns.${id}.firedAt` as never, new Date().toISOString() as never)
  },

  snooze(id: number, until: string): void {
    store.set(`checkIns.${id}.snoozedUntil` as never, until as never)
  },

  removePendingForTask(taskId: number): void {
    const all = store.get('checkIns')
    for (const [id, ci] of Object.entries(all)) {
      if (ci.taskId === taskId && ci.firedAt === null) {
        delete all[Number(id)]
      }
    }
    store.set('checkIns', all)
  },

  removeAllPending(): void {
    const all = store.get('checkIns')
    for (const [id, ci] of Object.entries(all)) {
      if (ci.firedAt === null) {
        delete all[Number(id)]
      }
    }
    store.set('checkIns', all)
  },

  pendingForTask(taskId: number): CheckIn[] {
    const all = store.get('checkIns')
    return Object.values(all)
      .filter((ci) => ci.taskId === taskId && ci.firedAt === null)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  }
}

export function exportData(): ExportData {
  const tasks = Object.values(store.get('tasks')).map((t) => ({ ...t } as Task))
  const projects = Object.values(store.get('projects'))
  const recurringTemplates = Object.values(store.get('recurringTemplates'))
  const settings = settingsQueries.get()

  return {
    version: '1.0',
    app: 'taskify',
    exportedAt: new Date().toISOString(),
    tasks,
    projects,
    recurringTemplates,
    settings
  }
}

export function importData(
  data: ExportData,
  mode: 'replace' | 'append',
  includeSettings: boolean
): ImportResult {
  if (mode === 'replace') {
    store.set('tasks', {})
    store.set('tasksByDate', {})
    store.set('projects', {})
    store.set('recurringTemplates', {})

    const tasks: Record<number, Task> = {}
    const tasksByDate: Record<string, number[]> = {}

    for (const t of data.tasks) {
      tasks[t.id] = t
      if (!t.backlog) {
        if (!tasksByDate[t.date]) tasksByDate[t.date] = []
        tasksByDate[t.date].push(t.id)
      }
    }
    store.set('tasks', tasks as never)
    store.set('tasksByDate', tasksByDate as never)

    const projects: Record<number, Project> = {}
    for (const p of data.projects) projects[p.id] = p
    store.set('projects', projects as never)

    const templates: Record<number, RecurringTemplate> = {}
    for (const t of data.recurringTemplates) templates[t.id] = t
    store.set('recurringTemplates', templates as never)

    const maxTaskId = Math.max(0, ...data.tasks.map((t) => t.id))
    const maxProjectId = Math.max(0, ...data.projects.map((p) => p.id))
    const maxTemplateId = Math.max(0, ...data.recurringTemplates.map((t) => t.id))
    store.set('nextTaskId', maxTaskId + 1)
    store.set('nextProjectId', maxProjectId + 1)
    store.set('nextTemplateId', maxTemplateId + 1)

    if (includeSettings) {
      const { wizardCompleted, mcpPort, mcpEnabled, ...importedSettings } = data.settings
      store.set('settings', { ...settingsQueries.get(), ...importedSettings } as never)
    }

    return {
      tasks: data.tasks.length,
      projects: data.projects.length,
      templates: data.recurringTemplates.length
    }
  }

  // Append mode: remap IDs to avoid collisions, only import tasks
  const existingTasks = store.get('tasks')
  const maxExistingId = Math.max(0, ...Object.keys(existingTasks).map(Number))
  const offset = maxExistingId

  const tasksByDate = store.get('tasksByDate')

  for (const t of data.tasks) {
    const newId = t.id + offset
    const imported = { ...t, id: newId, templateId: t.templateId ? t.templateId + offset : null }
    store.set(`tasks.${newId}` as never, imported as never)
    if (!t.backlog) {
      const order: number[] = tasksByDate[t.date] ?? []
      tasksByDate[t.date] = [...order, newId]
    }
  }

  store.set('tasksByDate', tasksByDate as never)
  store.set('nextTaskId', maxExistingId + data.tasks.length + 1)

  return { tasks: data.tasks.length, projects: 0, templates: 0 }
}
