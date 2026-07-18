import { app, BrowserWindow, Tray, Menu, nativeImage, shell } from 'electron'
import path, { join } from 'path'

function localDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
import { fork, ChildProcess } from 'child_process'
import { is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { scheduleEndOfDay, rescheduleCheckIns, scheduleTaskAlarm } from './scheduler'
import { templateQueries, settingsQueries, taskQueries } from './db'
import { setupUpdates, checkForUpdates } from './updater'

let win: BrowserWindow | null = null
let tray: Tray | null = null
let mcpProcess: ChildProcess | null = null
let isQuitting = false

function createWindow(): BrowserWindow {
  win = new BrowserWindow({
    width: 780,
    height: 760,
    minWidth: 520,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    frame: true,
    title: 'Taskify',
    icon: path.join(__dirname, '../../resources/Square44x44Logo.targetsize-256.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.on('close', (e) => {
    if (isQuitting || settingsQueries.get().closeBehavior === 'exit') return
    e.preventDefault()
    win?.hide()
  })

  win.on('ready-to-show', () => win?.show())

  win.on('show', () => {
    generateTemplatesNow()
    scheduleAlarmsForToday()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function generateTemplatesNow(): void {
  const today = localDateString()
  const newTasks = templateQueries.generateDueTasks(today)
  if (newTasks.length > 0) {
    win?.webContents.send('tasks:refreshed')
  }
}

function scheduleAlarmsForToday(): void {
  const today = localDateString()
  const tasks = taskQueries.listByDate(today)
  for (const task of tasks) {
    if (task.scheduledTime && !task.completed) {
      scheduleTaskAlarm(task, win)
    }
  }
  rescheduleCheckIns(win)
}

function startMcpServer(): void {
  const settings = settingsQueries.get()
  if (!settings.mcpEnabled) return

  const mcpPath = path.join(__dirname, 'mcp-server.js')
  try {
    mcpProcess = fork(mcpPath, [], {
      env: { ...process.env, MCP_PORT: String(settings.mcpPort) },
      silent: false
    })

    mcpProcess.on('message', (msg: unknown) => {
      const req = msg as { id: string; type: string; payload: unknown }
      handleMcpBridgeRequest(req)
    })

    mcpProcess.on('exit', (code) => {
      console.log(`MCP server exited with code ${code}`)
      mcpProcess = null
    })
  } catch (e) {
    console.error('Failed to start MCP server:', e)
  }
}

function stopMcpServer(): void {
  if (mcpProcess) {
    mcpProcess.kill()
    mcpProcess = null
  }
}

function handleMcpBridgeRequest(req: { id: string; type: string; payload: unknown }): void {
  const { id, type, payload } = req

  const respond = (data: unknown) => {
    mcpProcess?.send({ id, ok: true, data })
  }
  const respondError = (error: string) => {
    mcpProcess?.send({ id, ok: false, error })
  }

  try {
    const p = payload as Record<string, unknown>
    switch (type) {
      case 'tasks:listByDate': {
        const { taskQueries } = require('./db')
        respond(taskQueries.listByDate(p.date as string))
        break
      }
      case 'tasks:listToday': {
        const { taskQueries } = require('./db')
        respond(taskQueries.listByDate(localDateString()))
        break
      }
      case 'tasks:listOverdue': {
        const { taskQueries } = require('./db')
        respond(taskQueries.listOverdue(localDateString()))
        break
      }
      case 'tasks:listWeekHistory': {
        const { taskQueries } = require('./db')
        respond(taskQueries.listWeekHistory(localDateString()))
        break
      }
      case 'tasks:listByProject': {
        const { taskQueries } = require('./db')
        respond(taskQueries.listByProject(p.projectId as number))
        break
      }
      case 'tasks:listByTag': {
        const { taskQueries } = require('./db')
        const tag = p.tag as string
        const all = taskQueries.getAll() as Array<{ tags: string | null }>
        respond(all.filter((t) => {
          if (!t.tags) return false
          try { return (JSON.parse(t.tags) as string[]).includes(tag) }
          catch { return false }
        }))
        break
      }
      case 'tasks:getById': {
        const { taskQueries } = require('./db')
        respond(taskQueries.getById(p.id as number))
        break
      }
      case 'tasks:create': {
        const { taskQueries } = require('./db')
        const today = localDateString()
        respond(taskQueries.add(p.title as string, (p.date as string) ?? today, {
          estimatedMinutes: p.estimatedMinutes as number | undefined,
          projectId: p.projectId as number | undefined,
          tags: p.tags as string[] | undefined
        }))
        break
      }
      case 'tasks:update': {
        const { taskQueries } = require('./db')
        const { id: taskId, tags, links, date: newDate, projectId, ...fields } = p as {
          id: number; tags?: string[]; links?: string[]; date?: string; projectId?: number | null
          title?: string; completed?: boolean; notes?: string; estimatedMinutes?: number | null
        }
        if (newDate !== undefined) taskQueries.rescheduleDate(taskId, newDate)
        respond(taskQueries.update(taskId, {
          ...fields,
          projectId,
          tags: tags !== undefined ? JSON.stringify(tags) : undefined,
          links: links !== undefined ? JSON.stringify(links) : undefined
        }))
        break
      }
      case 'tasks:delete': {
        const { taskQueries } = require('./db')
        taskQueries.delete(p.id as number)
        respond({ ok: true })
        break
      }
      case 'tasks:pullToToday': {
        const { taskQueries } = require('./db')
        respond(taskQueries.pullToToday(p.taskId as number, localDateString()))
        break
      }
      case 'projects:list': {
        const { projectQueries } = require('./db')
        respond(projectQueries.list())
        break
      }
      case 'projects:create': {
        const { projectQueries } = require('./db')
        respond(projectQueries.add(p.name as string, p.color as string, p.description as string | undefined))
        break
      }
      case 'projects:update': {
        const { projectQueries } = require('./db')
        respond(projectQueries.update(p.id as number, p as Record<string, unknown>))
        break
      }
      case 'templates:list': {
        const { templateQueries } = require('./db')
        respond(templateQueries.list())
        break
      }
      case 'templates:create': {
        const { templateQueries } = require('./db')
        respond(templateQueries.add(p as Parameters<typeof templateQueries.add>[0]))
        break
      }
      case 'templates:setActive': {
        const { templateQueries } = require('./db')
        respond(templateQueries.setActive(p.id as number, p.active as boolean))
        break
      }
      default:
        respondError(`Unknown bridge type: ${type}`)
    }
  } catch (e) {
    respondError(String(e))
  }
}

function createTray(): void {
  const iconPath = path.join(__dirname, '../../resources/Square44x44Logo.targetsize-16.png')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('Taskify')

  const menu = Menu.buildFromTemplate([
    { label: 'Open Taskify', click: () => { win?.show(); win?.focus() } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.quit() } }
  ])
  tray.setContextMenu(menu)

  tray.on('click', () => {
    if (win?.isVisible()) {
      win.hide()
    } else {
      win?.show()
      win?.focus()
    }
  })
}

app.whenReady().then(() => {
  registerIpcHandlers(() => win)
  createWindow()
  setupUpdates(() => win)
  createTray()
  scheduleEndOfDay(() => win)
  generateTemplatesNow()
  scheduleAlarmsForToday()
  startMcpServer()
  setTimeout(() => { void checkForUpdates() }, 5000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  isQuitting = true
  win?.removeAllListeners('close')
  stopMcpServer()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
