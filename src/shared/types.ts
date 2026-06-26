export interface Task {
  id: number
  date: string         // YYYY-MM-DD
  title: string
  completed: boolean
  completedAt: string | null
  notes: string | null
  links: string | null    // JSON array of strings
  estimatedMinutes: number | null
  scheduledTime: string | null  // HH:MM local time, triggers notification when reached
  sortOrder: number
  createdAt: string
  projectId: number | null
  tags: string | null     // JSON array of strings
  templateId: number | null
  backlog: boolean
}

export interface Project {
  id: number
  name: string
  color: string
  description: string | null
  createdAt: string
  archivedAt: string | null
}

export type RecurrenceSchedule =
  | { type: 'daily' }
  | { type: 'weekly'; dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6 }
  | { type: 'every_n_days'; n: number; anchorDate: string }
  | { type: 'monthly'; dayOfMonth: number }

export interface RecurringTemplate {
  id: number
  title: string
  estimatedMinutes: number | null
  projectId: number | null
  tags: string | null
  schedule: RecurrenceSchedule
  active: boolean
  lastInstanceDate: string | null
  createdAt: string
}

export interface CheckIn {
  id: number
  taskId: number
  scheduledAt: string
  firedAt: string | null
  snoozedUntil: string | null
}

export interface AppSettings {
  endOfDayTime: string
  startOfDayTime: string
  defaultCheckInInterval: number
  theme: 'light' | 'dark'
  wizardCompleted: boolean
  mcpPort: number
  mcpEnabled: boolean
}

export interface TaskDateGroup {
  date: string
  tasks: Task[]
}

export type OverdueDateGroup = TaskDateGroup

export interface ExportData {
  version: string
  app: string
  exportedAt: string
  tasks: Task[]
  projects: Project[]
  recurringTemplates: RecurringTemplate[]
  settings: AppSettings
}

export interface ImportResult {
  tasks: number
  projects: number
  templates: number
}

export type IpcChannel =
  | 'tasks:list'
  | 'tasks:add'
  | 'tasks:update'
  | 'tasks:delete'
  | 'tasks:reorder'
  | 'tasks:listByDate'
  | 'tasks:listOverdue'
  | 'tasks:listWeekHistory'
  | 'tasks:listByProject'
  | 'tasks:pullToToday'
  | 'projects:list'
  | 'projects:add'
  | 'projects:update'
  | 'projects:archive'
  | 'projects:delete'
  | 'templates:list'
  | 'templates:add'
  | 'templates:update'
  | 'templates:setActive'
  | 'templates:delete'
  | 'templates:generateToday'
  | 'data:export'
  | 'data:import'
  | 'wizard:requestNotificationPermission'
  | 'settings:get'
  | 'settings:set'
  | 'checkins:schedule'
  | 'checkins:cancel'
  | 'app:openWindow'

export interface TaskAddPayload {
  title: string
  estimatedMinutes?: number
  scheduledTime?: string
  date?: string
  projectId?: number | null
  tags?: string[]
  backlog?: boolean
  templateId?: number | null
  schedule?: RecurrenceSchedule
}

export interface TaskUpdatePayload {
  id: number
  title?: string
  completed?: boolean
  notes?: string | null
  links?: string[]
  estimatedMinutes?: number | null
  scheduledTime?: string | null
  tags?: string[]
  projectId?: number | null
}

export interface TaskReorderPayload {
  date: string
  orderedIds: number[]
}

export interface ProjectAddPayload {
  name: string
  color: string
  description?: string
}

export interface ProjectUpdatePayload {
  id: number
  name?: string
  color?: string
  description?: string
}

export interface TemplateAddPayload {
  title: string
  schedule: RecurrenceSchedule
  estimatedMinutes?: number
  projectId?: number | null
  tags?: string[]
}

export interface TemplateUpdatePayload {
  id: number
  title?: string
  schedule?: RecurrenceSchedule
  estimatedMinutes?: number | null
  projectId?: number | null
  tags?: string[]
}
