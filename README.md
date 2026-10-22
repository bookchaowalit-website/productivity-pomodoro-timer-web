# Pomodoro Timer (Focus Fold)

A client-side Pomodoro focus clock: Focus (25 min), Short break (5 min) and Long break (15 min), with start/pause/reset
and an in-memory count of completed focus sessions. Every fourth completed focus opens a long break.

Live: https://pomodoro-timer.bookchaowalit.com (deployed by Vercel CLI; it can lag `main`, see `PRODUCT.md`).

## What it does not do

- No sound, browser notifications or alerts when a session ends.
- No saved history: the session count resets when the page reloads. No account, no sync.
- Durations are fixed; they cannot be customised.

## Run

```bash
npm ci
npm run dev
```

## Checks

```bash
npm test           # node:test with fake timers (lib/timer.ts), the MCP handler and the Sentry scrubbing
npm run lint
npm run typecheck
npm run build
```

CI (`.github/workflows/ci.yml`) runs the shared Node workflow and the shared security scan on every push and PR to `main`.

## Code map

- `lib/timer.ts`: pure timer transitions (mode switch, tick, reset, session counting).
- `lib/mcp.ts` + `app/api/mcp/route.ts`: JSON-RPC endpoint with one tool, `get_timer_modes`, that returns the real modes and durations.
- `lib/sentry.ts` + `instrumentation*.ts`: error reporting to Sentry, errors only, personal data stripped; off when
  `NEXT_PUBLIC_SENTRY_DSN` is unset.

## Related

- **Mobile App:** [bookchaowalit-pomodoro-timer-mobile](https://github.com/bookchaowalit-mobile/bookchaowalit-pomodoro-timer-mobile)
- **Portfolio:** [bookchaowalit.com](https://bookchaowalit.com)
