# Taskify — Architecture & How It Works

## Overview

Taskify is a Windows desktop app (cross-platform capable) built on **Electron 29** with a **React 18 + TypeScript** renderer and **electron-store** for local JSON persistence. It lives in the system tray and is designed for minimal friction: one keystroke to add a task, one click to complete it.

---

## Process Model

Electron splits the app into two isolated OS processes that communicate over IPC, with an optional third process for the MCP server.

```
┌─────────────────────────────────────────────────────────┐
│  Main Process  (Node.js)                                │
│                                                         │
│  ┌──────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │ db.ts    │  │ ipc.ts     │  │ scheduler.ts       │  │
│  │ electron │  │ registers  │  │ node-schedule jobs  │  │
│  │ -store   │  │ IPC handles│  │ system tray notifs  │  │
│  └──────────┘  └────────────┘  └────────────────────┘  │
│                       │                                 │
│  child_process.fork() ──► mcp-server.js (optional)     │
└───────────────────────┼─────────────────────────────────┘
                        │  contextBridge (preload)
┌───────────────────────┼─────────────────────────────────┐
│  Renderer Process  (Chromium + React)                   │
│                                                         │
│  ┌─────────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │ TodayView   │  │ ProjectsView  │  │ SettingsView │  │
│  └─────────────┘  └───────────────┘  └──────────────┘  │
│  ┌─────────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │ HistoryView │  │ WizardModal   │  │ AddTaskBar   │  │
│  └─────────────┘  └───────────────┘  └──────────────┘  │
│  ┌─────────────┐  ┌───────────────┐                    │
│  │ TaskList    │  │ OverdueTasks  │                    │
│  │ TaskItem    │  │               │                    │
│  └─────────────┘  └───────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

### Main Process (`src/main/`)

| File | Responsibility |
|---|---|
| `index.ts` | App lifecycle, `BrowserWindow`, system tray, minimize-to-tray, recurring task generation on startup/focus, MCP server fork |
| `db.ts` | All reads/writes to the electron-store JSON database |
| `ipc.ts` | Registers `ipcMain.handle()` endpoints that the renderer calls |
| `scheduler.ts` | Schedules `node-schedule` jobs for check-ins and end-of-day reminders, fires `Notification` objects |

### Preload Script (`src/preload/index.ts`)

Uses `contextBridge.exposeInMainWorld` to expose a typed `window.taskify` API:

```
Renderer → window.taskify.tasks.add(...)
         → ipcRenderer.invoke('tasks:add', ...)
         → [IPC] →
         Main → ipcMain.handle('tasks:add', ...)
              → db.taskQueries.add(...)
              → electron-store write
              → returns Task
```

### Renderer Process (`src/renderer/`)

A standard Vite + React SPA. Has no direct filesystem or Node access — everything goes through `window.taskify`. Built with Tailwind CSS using semantic color tokens that swap between light and dark themes via CSS custom properties.

---

## Data Layer

### Storage

**electron-store** persists a single JSON file at `%AppData%/taskify/config.json`. No SQLite, no server — just a structured JSON object with synchronous read/write.

### Schema

```typescript
{
  tasks: {
    [id: number]: {
      id, date, title, completed, completedAt,
      notes, links,            // links: JSON-encoded string[]
      estimatedMinutes,
      sortOrder, createdAt,
      projectId,               // number | null
      tags,                    // JSON-encoded string[] | null
      templateId,              // number | null — set if from a RecurringTemplate
      backlog                  // boolean — true = project backlog, not on Today
    }
  },

  tasksByDate: {
    "2026-06-19": [3, 1, 4, 2],   // ordered array of task IDs for that date
  },

  checkIns: {
    [id: number]: {
      id, taskId, scheduledAt, firedAt, snoozedUntil
    }
  },

  projects: {
    [id: number]: {
      id, name, color, description, createdAt, archivedAt
    }
  },

  recurringTemplates: {
    [id: number]: {
      id, title, estimatedMinutes, projectId, tags,
      schedule,           // RecurrenceSchedule (see Recurrence section)
      active,             // boolean — paused templates don't generate tasks
      lastInstanceDate,   // YYYY-MM-DD of most recently generated instance
      createdAt
    }
  },

  settings: {
    endOfDayTime: "17:00",
    startOfDayTime: "09:00",
    defaultCheckInInterval: 30,
    theme: "dark",
    wizardCompleted: false,      // true after first-run wizard is dismissed
    mcpPort: 57391,
    mcpEnabled: false
  },

  nextTaskId: number,
  nextCheckInId: number,
  nextProjectId: number,
  nextTemplateId: number
}
```

### Why this structure

Tasks are stored as a flat map keyed by ID for O(1) lookup. The per-date ordering is kept in a separate `tasksByDate` array of IDs so reordering is a cheap array mutation. Backlog tasks (projectId set, not yet pulled to Today) are stored in `tasks` with `backlog: true` and omitted from `tasksByDate` entirely — they never appear in TodayView until explicitly pulled.

---

## Task Lifecycle

```
Add task (TodayView)
  │
  ├─ db.taskQueries.add()     → writes task, appends ID to tasksByDate[date]
  └─ scheduler.scheduleCheckIns()  → creates node-schedule jobs if estimatedMinutes set
        │
        └─ At each interval within the estimate window:
              db.checkInQueries.add()   → stores scheduled check-in
              node-schedule job fires   → Notification with action buttons
                    │
                    ├─ "Mark Complete"  → taskQueries.update(completed: true)
                    │                     cancelCheckIns() cancels remaining jobs
                    │                     win.webContents.send('tasks:refreshed')
                    │
                    └─ "+15 min"        → checkInQueries.snooze()
                                          new node-schedule job 15 min out

Add task to project backlog
  │
  └─ db.taskQueries.add(..., { backlog: true })
       → stored in tasks map, NOT added to tasksByDate
       → visible only in ProjectsView

Pull backlog task to Today
  │
  └─ db.taskQueries.pullToToday()
       → sets backlog = false, date = today
       → appends to tasksByDate[today]
       → task appears in TodayView on next refresh
```

---

## Check-in Scheduling

When a task is added or updated with `estimatedMinutes`, `scheduleCheckIns()` calculates firing times:

```
now  ──────────────────────────────────────────────────> estimated end
     |         |         |         |
  +30min    +60min    +90min   (end of window)
   fire      fire      fire
```

The interval is configurable in Settings (default: 30 min). Jobs are held in a `Map<string, schedule.Job>` in memory and are rescheduled from the database on next launch for any still-pending check-ins on incomplete tasks.

> **Note:** Windows 11 notification action buttons ("Mark Complete", "+15 min") work reliably in a packaged build but may not render in dev mode.

---

## Tags & Projects

### Tags

Tags are stored as a JSON-encoded `string[]` on each task (`tags` field). They can be entered in two ways:

- **Inline extraction** — type `#word` in the task title; on submit the app strips them from the title and populates the tags array.
- **Detail panel** — expand a task to see a tag editor with add/remove controls.

Tags are rendered as colored pills in `TaskItem`. Colors are derived deterministically from the tag string so the same tag always gets the same color:

```typescript
function tagColor(tag: string): string {
  const palette = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', ...]
  let hash = 0
  for (const c of tag) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return palette[Math.abs(hash) % palette.length]
}
```

A **filter bar** appears at the top of TodayView when the current day has at least one tagged task, allowing one-click filtering by tag.

### Projects

Projects are named containers with a color, optional description, and a task backlog. Each task has an optional `projectId`. The **Projects tab** (`ProjectsView`) shows:

- A list of active projects with colored dot indicators and task counts.
- An expanded backlog for the selected project with a **↑ Today** pull action per task.
- Tasks already pulled to today or completed show an "In progress" / "Done" indicator so they aren't pulled twice.
- A `+ New Project` inline form with a color palette picker.

Archived projects are hidden from the list; their tasks remain in the store and appear in History.

---

## Recurrence

### Schedule Types

| Pattern | Description |
|---|---|
| `daily` | Every weekday (Mon–Fri) |
| `weekly` | A specific day of the week |
| `every_n_days` | Every N calendar days from an anchor date |
| `monthly` | A specific day of the month (skips months where the day doesn't exist) |

### Generation Logic

Runs in the main process at two moments: **app startup** and **every time the BrowserWindow is shown** (catches day rollovers while the app was in the tray).

```
for each active RecurringTemplate:
  if isScheduledOn(template.schedule, today):
    if no incomplete task exists with templateId === template.id:
      create task for today, update template.lastInstanceDate
```

The "no duplicate" check means carry-over is handled naturally — an incomplete instance from a previous day IS the next instance. No backfill occurs if the app was closed for multiple days.

### UI

- The **↺ Repeat** row in `AddTaskBar` (collapsible) lets you set a schedule when creating a task. On submit, a `RecurringTemplate` is created and the first instance is immediately added to Today if the schedule fires today.
- Tasks generated from a template show a **↺** icon next to their title, which navigates to the Recurring sub-tab.
- The **Recurring sub-tab** (inside ProjectsView) lists all templates with active/paused toggle, inline edit panel, and delete.

---

## Welcome Wizard

A 5-step modal shown automatically on first launch (`settings.wizardCompleted === false`). Re-openable from Settings.

| Step | Content |
|---|---|
| 1 | Welcome / intro |
| 2 | Working hours (`startOfDayTime`, `endOfDayTime`) |
| 3 | Check-in interval (`defaultCheckInInterval`) |
| 4 | Notification permission request |
| 5 | Theme selection |

Each step writes to settings immediately via `settings:set`. Clicking **Finish** or **Skip** sets `wizardCompleted = true`. The modal does not close on backdrop click.

---

## Import / Export

### Export Format

```json
{
  "version": "1.0",
  "app": "taskify",
  "exportedAt": "2026-06-19T14:30:00.000Z",
  "tasks": [ { ...Task } ],
  "projects": [ { ...Project } ],
  "recurringTemplates": [ { ...RecurringTemplate } ],
  "settings": { ...AppSettings }
}
```

### Import Modes

| Mode | Behavior |
|---|---|
| **Replace** | Clears all existing tasks, projects, and templates. Imports everything from the file. |
| **Append tasks only** | Remaps task IDs to avoid collisions (`offset = max(existing IDs)`), skips projects/templates. |

Settings are excluded from import by default; an "Also restore settings" checkbox enables them.

The **Data** section in Settings provides Export JSON / Import JSON buttons with mode selector.

---

## MCP Server

An optional local Model Context Protocol server that lets AI agents (Claude Desktop, custom agents) read and write Taskify data while the app is running.

### Architecture

```
Electron Main Process
  │
  ├─ child_process.fork('mcp-server.js')
  │       │
  │       │  process.send({ id, type, payload })  ◄── MCP tool call
  │       │  process.on('message', { id, data })  ──► result
  │       │
  │  bridge handler: routes to db.ts query functions
  │
MCP Server Process (src/mcp/server.ts)
  │
  ├─ HTTP + SSE transport on http://127.0.0.1:<port>
  │     GET  /sse      → SSE stream (client connects here)
  │     POST /message  → JSON-RPC messages
  │     GET  /health   → { ok: true }
  │
  └─ Binds to 127.0.0.1 only (no network exposure)
```

### Tools

**Tasks:** `list_tasks_by_date`, `list_tasks_today`, `list_overdue_tasks`, `list_tasks_by_project`, `list_tasks_by_tag`, `create_task`, `update_task`, `delete_task`

**Projects:** `list_projects`, `create_project`, `update_project`, `pull_task_to_today`

**Templates:** `list_templates`, `create_template`, `set_template_active`

### Resources

`taskify://today` — Today's task list as `application/json`. Readable via `resources/read` without a tool call.

### Configuration

`mcpEnabled` (default `false`) and `mcpPort` (default `57391`) are in Settings. The server only starts when enabled. Settings shows a **Copy Claude Desktop config** button that copies the JSON snippet for `~/.config/claude/claude_desktop_config.json`.

```json
{
  "mcpServers": {
    "taskify": {
      "url": "http://localhost:57391/sse"
    }
  }
}
```

---

## Theme System

Theming is handled entirely with **CSS custom properties** (`--c-canvas`, `--c-accent`, etc.) defined in `index.css`. Toggling the `dark` class on `<html>` switches all tokens simultaneously.

Tailwind uses these tokens as custom colors (`bg-canvas`, `text-ink`, `border-rim`, etc.) so components write class names once and respond to the theme automatically — no `dark:` prefix variants needed.

```
:root          { --c-canvas: #F3F4F6; --c-accent: #2979FF; ... }  /* light */
html.dark      { --c-canvas: #121212; --c-accent: #2979FF; ... }  /* dark  */
```

The selected theme is persisted in `settings.theme` and applied immediately on app launch before the first render.

---

## Overdue / Carry-over Tasks

On startup and on every refresh, `tasks:listOverdue` scans all `tasksByDate` entries with a date earlier than today, collects incomplete non-backlog tasks, and groups them by date. The renderer displays these as collapsed accordion panels above the task input with human-friendly date labels:

| Age | Label |
|---|---|
| 1 day ago | Yesterday |
| 2–7 days ago | Day name (e.g. Tuesday) |
| > 7 days ago | Short date (e.g. Mon Jun 8) |

---

## Icons

| Surface | File |
|---|---|
| System tray | `resources/taskify-outline-original.png` |
| App header (renderer) | `resources/taskify-solid-original.png` (Vite-bundled) |
| BrowserWindow / taskbar | `resources/taskify-solid-original.png` |
| Windows packager (`.ico`) | `resources/taskify-solid-original.png` |
| macOS packager (`.icns`) | `resources/taskify-solid-original.png` |

---

## Project Structure

```
src/
  main/
    index.ts        App lifecycle, tray, window, MCP fork, template generation
    db.ts           electron-store queries (tasks, projects, templates, settings)
    ipc.ts          IPC handler registration
    scheduler.ts    Check-in & end-of-day scheduling
  mcp/
    server.ts       MCP server entry point (child process, HTTP+SSE transport)
    types.ts        BridgeRequest / BridgeResponse interfaces
    tools/
      tasks.ts      Task tool definitions & handlers
      projects.ts   Project tool definitions & handlers
      templates.ts  Template tool definitions & handlers
  preload/
    index.ts        contextBridge API surface (window.taskify)
  renderer/
    index.html
    src/
      main.tsx      React entry point
      App.tsx       Tab nav, theme toggle, wizard trigger
      index.css     Tailwind + CSS token definitions
      env.d.ts      window.taskify type declaration
      assets/
        taskify-solid-original.png
      hooks/
        useTasks.ts   useTasks(), useOverdueTasks()
      components/
        AddTaskBar.tsx      Task input with estimate + repeat picker + #tag extraction
        TaskItem.tsx        Task row with tags, ↺ indicator, detail panel
        TaskList.tsx        dnd-kit drag-to-reorder wrapper
        OverdueTasks.tsx    Accordion groups for carry-over tasks
        WizardModal.tsx     5-step first-run setup wizard
      views/
        TodayView.tsx       Today's tasks + tag filter bar + overdue carry-over
        ProjectsView.tsx    Projects sub-tab + Recurring sub-tab
        HistoryView.tsx     Browse tasks by past date
        SettingsView.tsx    App settings + Data import/export + MCP config
  shared/
    types.ts        Interfaces shared across all processes

resources/
  taskify-solid-original.png    App icon (3D blue bubble)
  taskify-outline-original.png  Tray icon (blue outline circle)
  taskify-logo-original.png     Full wordmark
  taskify-logo-compact-original.png  Compact wordmark
  icon.ico / icon.icns / icon.png    Legacy packager icons

docs/
  architecture.md   This file
```

---

## Running Locally

```bash
npm install
npm run dev        # Start with hot-reload (Vite dev server + Electron)
npm run build      # Production build to out/
npm run package    # Build + package to release/ (NSIS installer on Windows)
```

Dependencies require **Node 18+**. No native modules — everything is pure JS/TS, so no Visual Studio C++ build tools are needed.
