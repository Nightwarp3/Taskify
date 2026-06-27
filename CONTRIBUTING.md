# Contributing to Taskify

Thanks for taking a look at Taskify. Issues and focused pull requests are welcome.

## Development Setup

Desktop app:

```bash
npm install
npm run dev
```

Mobile app:

```bash
cd mobile
npm install
npm start
```

## Before Opening a Pull Request

- Keep changes focused on one problem or feature.
- Run the smallest useful test command for your change.
- Update docs when behavior, commands, or public-facing workflows change.
- Avoid committing generated output such as `out/`, `release/`, `test-results/`, or packaged extensions.

Useful checks:

```bash
npm run test:unit
npm run build
```

For mobile-only changes:

```bash
cd mobile
npm test
```

## Architecture Notes

The desktop renderer should access data only through `window.taskify`, which is exposed by the preload script. Shared data shapes live in `src/shared/types.ts` and are used by both the desktop and mobile apps.

Read [docs/architecture.md](docs/architecture.md) before making structural changes to storage, IPC, recurrence, scheduling, or MCP behavior.

## Pull Request Guidance

- Include a clear summary of what changed.
- Mention which tests you ran.
- For UI changes, include screenshots when practical.
- For larger features, open an issue first so the approach can be discussed.
