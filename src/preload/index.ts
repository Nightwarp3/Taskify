import { contextBridge, ipcRenderer } from 'electron'
import type {
  Task,
  AppSettings,
  OverdueDateGroup,
  TaskDateGroup,
  TaskAddPayload,
  TaskUpdatePayload,
  TaskReorderPayload,
  Project,
  ProjectAddPayload,
  ProjectUpdatePayload,
  RecurringTemplate,
  TemplateAddPayload,
  TemplateUpdatePayload,
  ImportResult
} from '../shared/types'

const api = {
  tasks: {
    listByDate: (date: string): Promise<Task[]> =>
      ipcRenderer.invoke('tasks:listByDate', date),
    listOverdue: (today: string): Promise<OverdueDateGroup[]> =>
      ipcRenderer.invoke('tasks:listOverdue', today),
    listWeekHistory: (today: string): Promise<TaskDateGroup[]> =>
      ipcRenderer.invoke('tasks:listWeekHistory', today),
    listByProject: (projectId: number): Promise<Task[]> =>
      ipcRenderer.invoke('tasks:listByProject', projectId),
    add: (payload: TaskAddPayload): Promise<Task> =>
      ipcRenderer.invoke('tasks:add', payload),
    update: (payload: TaskUpdatePayload): Promise<Task | null> =>
      ipcRenderer.invoke('tasks:update', payload),
    delete: (id: number): Promise<void> =>
      ipcRenderer.invoke('tasks:delete', id),
    reorder: (payload: TaskReorderPayload): Promise<void> =>
      ipcRenderer.invoke('tasks:reorder', payload),
    pullToToday: (id: number): Promise<Task | null> =>
      ipcRenderer.invoke('tasks:pullToToday', id)
  },
  projects: {
    list: (): Promise<Project[]> =>
      ipcRenderer.invoke('projects:list'),
    add: (payload: ProjectAddPayload): Promise<Project> =>
      ipcRenderer.invoke('projects:add', payload),
    update: (payload: ProjectUpdatePayload): Promise<Project | null> =>
      ipcRenderer.invoke('projects:update', payload),
    archive: (id: number): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('projects:archive', id),
    delete: (id: number): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('projects:delete', id)
  },
  templates: {
    list: (): Promise<RecurringTemplate[]> =>
      ipcRenderer.invoke('templates:list'),
    add: (payload: TemplateAddPayload): Promise<RecurringTemplate> =>
      ipcRenderer.invoke('templates:add', payload),
    update: (payload: TemplateUpdatePayload): Promise<RecurringTemplate | null> =>
      ipcRenderer.invoke('templates:update', payload),
    setActive: (id: number, active: boolean): Promise<RecurringTemplate | null> =>
      ipcRenderer.invoke('templates:setActive', { id, active }),
    delete: (id: number): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('templates:delete', id),
    generateToday: (today: string): Promise<Task[]> =>
      ipcRenderer.invoke('templates:generateToday', today)
  },
  data: {
    export: (): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('data:export'),
    import: (opts: {
      mode: 'replace' | 'append'
      includeSettings: boolean
    }): Promise<{ ok: boolean; imported?: ImportResult; error?: string }> =>
      ipcRenderer.invoke('data:import', opts)
  },
  settings: {
    get: (): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:get'),
    set: (key: keyof AppSettings, value: unknown): Promise<void> =>
      ipcRenderer.invoke('settings:set', key, value)
  },
  wizard: {
    requestNotificationPermission: (): Promise<{ granted: boolean }> =>
      ipcRenderer.invoke('wizard:requestNotificationPermission')
  },
  on: (channel: string, fn: (...args: unknown[]) => void) => {
    const listener = (_: Electron.IpcRendererEvent, ...args: unknown[]) => fn(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('taskify', api)

export type TaskifyAPI = typeof api
