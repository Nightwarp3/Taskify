# Taskify

Taskify is a focused task manager for people who plan their day in small, concrete pieces. The desktop app lives in the system tray, keeps today's work close, and can nudge you with timed check-ins when a task has an estimate.

The repository includes:

- A Windows-first Electron desktop app built with React, TypeScript, and Tailwind CSS.
- A native Expo / React Native mobile companion app under `mobile/`.
- An optional local MCP server so AI agents can read and update Taskify while the desktop app is running.

## Features

- **Today view** - add, reorder, complete, and filter the day's tasks.
- **Inline tags** - type `#tag` in a title or manage tags from the task detail panel.
- **Projects** - keep backlog tasks in named project lists, then pull them into Today.
- **Recurring tasks** - daily, weekly, every-N-days, and monthly templates.
- **Timed check-ins** - estimate a task and receive progress reminders.
- **History** - browse completed work by date.
- **Import / export** - back up or move data with versioned JSON files.
- **Local MCP server** - expose tasks, projects, and templates to local AI agents over HTTP + SSE.
- **Light and dark themes** - shared design tokens across desktop and mobile.

## Privacy and Data

Taskify is local-first. The desktop app stores data in an `electron-store` JSON file on the user's machine and does not require a hosted backend. The MCP server is disabled by default and, when enabled, binds to `127.0.0.1` only.

Desktop storage location:

```text
%AppData%/taskify/config.json
```

The mobile app stores data locally through AsyncStorage and supports JSON import/export from the app.

## Requirements

- Node.js 18+
- npm 9+
- Windows for the packaged desktop installer
- Android Studio and/or Xcode for native mobile builds

The desktop app does not use native Node modules, so Visual Studio C++ build tools are not required.

## Desktop Development

```bash
npm install
npm run dev
```

`npm run dev` starts Electron through `electron-vite` with renderer hot reload. Renderer changes under `src/renderer/src/` reload automatically. Main process, preload, and MCP changes usually require restarting Electron.

Useful commands:

```bash
npm run build       # Build desktop bundles into out/
npm run package     # Build a Windows installer into release/
npm run test:unit   # Run Vitest unit tests
npm run test:e2e    # Build, then run Playwright E2E tests
npm run test        # Run unit and E2E tests
```

To run a compiled build without packaging:

```bash
npx electron out/main/index.js
```

## Mobile Development

The mobile app is a native Expo project that reuses the shared Taskify data model but implements its own React Native UI.

```bash
cd mobile
npm install
npm start
```

Useful mobile commands:

```bash
npm run android     # Build and launch Android via Expo
npm run ios         # Build and launch iOS via Expo
npm test            # Run mobile Vitest tests
```

## Releases

Desktop releases are tag-driven. Pushing a tag that matches `v*.*.*` runs the Windows release workflow, bumps `package.json`, builds the installer, and publishes GitHub Release assets.

```bash
git tag v0.0.4
git push origin v0.0.4
```

The release workflow expects the GitHub Actions release environment to provide `GH_TOKEN`.

Mobile builds are run manually from the `Build and Release Mobile (EAS)` workflow. That workflow builds the Expo project with EAS and expects `EXPO_TOKEN` to be configured as a GitHub Actions secret.

## MCP Server

Enable the MCP server in **Settings > MCP Server**. Local MCP clients can then connect while Taskify is running:

```text
SSE endpoint:  http://localhost:57391/sse
POST endpoint: http://localhost:57391/message
```

Claude Desktop example:

```json
{
  "mcpServers": {
    "taskify": {
      "url": "http://localhost:57391/sse"
    }
  }
}
```

The server starts only when enabled and binds to `127.0.0.1`.

## Project Layout

```text
src/
  main/           Electron main process: app lifecycle, db, IPC, scheduler
  mcp/            Optional MCP server and tool definitions
  preload/        contextBridge API exposed to the renderer
  renderer/src/   React desktop UI
  shared/         TypeScript interfaces shared by desktop and mobile

mobile/           Expo / React Native companion app
resources/        App icons and release assets
docs/             Architecture and implementation notes
tests/            Desktop unit and E2E tests
```

See [docs/architecture.md](docs/architecture.md) for a deeper walkthrough of the process model, data schema, IPC surface, recurring task generation, MCP bridge, and mobile architecture.

## Contributing

Issues and focused pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

For security reports, see [SECURITY.md](SECURITY.md).

## License

Taskify is licensed under the [MIT License](LICENSE).
