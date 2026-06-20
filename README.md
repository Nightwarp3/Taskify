# Taskify

A focused daily task manager for Windows. Lives in the system tray, checks in on timed tasks, and stays out of your way.

---

## Features

- **Today view** — add tasks, drag to reorder, complete with one click
- **Tags** — label tasks with `#tag` inline or via the detail panel; filter Today by tag
- **Projects** — pre-plan work in named backlogs, pull tasks to Today when ready
- **Recurring tasks** — daily, weekly, every-N-days, or monthly schedules; auto-generated on startup
- **Check-ins** — set an estimate on a task and get timed notifications to check progress
- **History** — browse any past date's completed tasks
- **Import / Export** — back up or migrate data as a versioned JSON file
- **MCP server** — expose Taskify to local AI agents (Claude Desktop, etc.) over HTTP+SSE
- **Light / dark theme**

---

## Requirements

- **Node.js 18+**
- **npm 9+**
- No native modules — no Visual Studio C++ build tools required

---

## Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Start in development mode (hot-reload)
npm run dev
```

`npm run dev` starts the Vite renderer dev server and Electron simultaneously. Changes to renderer files (React components, CSS) hot-reload without restarting Electron. Changes to main-process files (`src/main/`, `src/preload/`) require an Electron restart — quit the window and re-run `npm run dev`.

---

## Building

```bash
# Compile everything to out/
npm run build
```

Output goes to `out/`:

```
out/
  main/        Compiled main process (index.js + mcp-server.js)
  preload/     Compiled preload script
  renderer/    Bundled React SPA (HTML + hashed assets)
```

To run the compiled build without packaging:

```bash
npx electron out/main/index.js
```

---

## Packaging (Windows installer)

```bash
npm run package
```

This runs `electron-vite build` followed by `electron-builder`. The output is an NSIS installer at `release/Taskify Setup x.y.z.exe`.

> electron-builder reads icon and metadata from the `build` section of `package.json`.

---

## Project Layout

```
src/
  main/           Main process (Node.js): db, IPC, scheduler, MCP fork
  mcp/            MCP server child process + tool definitions
  preload/        contextBridge API exposed to renderer as window.taskify
  renderer/src/   React app (views, components, hooks)
  shared/         TypeScript interfaces shared across all processes

resources/        App icons (tray, window, packager)
docs/
  architecture.md Full architecture reference
```

See [`docs/architecture.md`](docs/architecture.md) for a complete walkthrough of the data model, IPC surface, recurring task generation, MCP server, and more.

---

## Making Changes

### Renderer (React)

Edit files under `src/renderer/src/`. Changes hot-reload automatically in `npm run dev`.

All data access goes through `window.taskify` (typed as `TaskifyAPI` from `src/preload/index.ts`). Never call Node APIs directly from the renderer.

### Main Process

Edit files under `src/main/`. After saving, quit Electron and re-run `npm run dev` — the main process is rebuilt but not hot-reloaded.

- **`db.ts`** — add new store queries here. Update `StoreSchema` and `defaults` for any new fields; electron-store applies defaults automatically for existing installs.
- **`ipc.ts`** — register new `ipcMain.handle()` channels here.
- **`scheduler.ts`** — modify check-in or end-of-day notification logic here.

### Adding a new IPC channel

1. Add the channel name to `IpcChannel` in `src/shared/types.ts`.
2. Add any payload types to `src/shared/types.ts`.
3. Implement the handler in `src/main/ipc.ts`.
4. Expose it in `src/preload/index.ts` under the appropriate namespace.
5. Call it from the renderer via `window.taskify.<namespace>.<method>()`.

### Adding a new MCP tool

1. Add the tool definition (name, description, inputSchema) to the appropriate file in `src/mcp/tools/`.
2. Add a case to that file's `handle*Tool` function.
3. Add the corresponding bridge case in `handleMcpBridgeRequest()` in `src/main/index.ts`.

### Shared types

`src/shared/types.ts` is imported by the main process, preload, and renderer. Keep it free of Node-only or browser-only imports.

### Data / store migrations

electron-store applies `defaults` for any key not present in the existing store file — this handles additive migrations automatically. For destructive changes (renaming or removing fields), add a migration in `db.ts` using electron-store's `migrations` option.

### Settings

New settings fields go in `AppSettings` (`src/shared/types.ts`) with a default value in `store` defaults in `db.ts`. The renderer reads and writes them through `window.taskify.settings.get/set`.

---

## MCP Server (AI agent integration)

Enable the MCP server in **Settings → MCP Server**. Once enabled, any local MCP client can connect:

```
SSE endpoint:  http://localhost:57391/sse
POST endpoint: http://localhost:57391/message
```

Copy the Claude Desktop config snippet from Settings and paste it into your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "taskify": {
      "url": "http://localhost:57391/sse"
    }
  }
}
```

The server only starts when enabled and always binds to `127.0.0.1` — it is not reachable from the network.
