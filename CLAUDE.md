# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Vite HMR for renderer + Electron live reload)
npm run build        # Compile TypeScript → out/ (main, preload, renderer, MCP server)
npm run package      # Full Windows build: build → electron-builder → NSIS installer in release/
npm run test:unit    # Vitest unit tests (tests/unit/**/*.test.ts)
npm run test:e2e     # Build then run Playwright E2E tests (tests/e2e/)
npm run test         # Both unit + E2E
```

## Architecture

Taskify is a three-process Electron app:

**Main process** (`src/main/`) — Node.js, runs the app lifecycle, system tray, and background scheduling.
- `index.ts` — BrowserWindow setup, tray icon, MCP child process fork, recurring task generation on startup
- `db.ts` — All electron-store reads/writes (tasks, projects, templates, settings); this is the only place that touches the store
- `ipc.ts` — Registers all `ipcMain.handle()` handlers; thin wrappers that delegate to `db.ts`
- `scheduler.ts` — `node-schedule` jobs for check-in notifications and end-of-day reminders

**Renderer** (`src/renderer/src/`) — React 18 SPA, Tailwind CSS, communicates with main via `window.taskify` (the contextBridge API).
- `App.tsx` — Tab routing (Today / Projects / History / Settings), theme toggle
- `views/` — One component per tab
- `hooks/useTasks.ts` — Primary state hook; calls `window.taskify.*` IPC methods and manages local React state
- `components/` — Shared UI: `AddTaskBar`, `TaskItem`, `TaskList`, `OverdueTasks`, `WizardModal`

**MCP server** (`src/mcp/`) — Optional HTTP+SSE child process forked by main at startup, listening on `127.0.0.1:57391`. Exposes AI agent tools for tasks, projects, and templates. Entry: `src/mcp/server.ts`; tool handlers in `src/mcp/tools/`.

**Preload** (`src/preload/index.ts`) — Exposes `window.taskify` API to renderer via `contextBridge`. The renderer's `src/env.d.ts` declares the types for this API.

**Shared types** (`src/shared/types.ts`) — `Task`, `Project`, `RecurringTemplate`, and other interfaces used across all processes.

### Data flow

```
Renderer (window.taskify.*)
  → ipcRenderer.invoke()
  → preload bridge
  → ipcMain.handle() in ipc.ts
  → db.ts
  → electron-store (JSON at %AppData%/taskify/)
```

### Build system

`electron-vite` builds three separate bundles from `electron.vite.config.ts`:
- Main + MCP server → `out/main/`
- Preload → `out/preload/`
- Renderer (Vite SPA) → `out/renderer/`

TypeScript is split into `tsconfig.node.json` (main/preload, Node target) and `tsconfig.web.json` (renderer, browser target). The renderer uses path alias `@renderer` → `src/renderer/src/`.

### Theming

Colors are CSS custom properties defined in `src/renderer/src/index.css` and mapped in `tailwind.config.js`. Dark/light mode is toggled via a class on `<html>`; always use Tailwind tokens rather than hardcoded colors.

## Key reference docs

- `docs/architecture.md` — Deep-dive on data schema, task lifecycle, recurrence logic, check-in scheduling, MCP design, and complete source map. Read this before making structural changes.
