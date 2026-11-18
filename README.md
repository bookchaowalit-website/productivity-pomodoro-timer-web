# Pomodoro Timer

A client-side Pomodoro focus clock: Focus (25 min), Short break (5 min) and Long break (15 min), with start/pause/reset
and an in-memory count of completed focus sessions. Every fourth completed focus opens a long break.

The page uses the shared App shell look (Geist Sans, light and dark from the system setting); see `APP-SHELL.md` and
`DESIGN.md`. While the clock runs, the tab title shows the time left; after a round it reads "Time is up".

Live: https://pomodoro-timer.bookchaowalit.com (Vercel deploys `main` through its Git integration;
`.github/workflows/deploy-smoke.yml` checks each Production deployment).

## What it does not do

- No sound, browser notifications or alerts when a session ends (only the tab title changes).
- No analytics: Vercel Analytics and Speed Insights were removed on 2026-11-18 (owner decision 2026-11-17).
- No saved history: the session count resets when the page reloads. No account, no sync.
- Durations are fixed; they cannot be customised.

## Run

```bash
npm ci
npm run dev
```

## Checks

```bash
npm test           # vitest: timer logic, mounted page tests (happy-dom, fake timers), MCP, health, Sentry
npm test -- --coverage
npm run lint
npm run typecheck
npm run build
```

CI (`.github/workflows/ci.yml`) runs the shared Node workflow and the shared security scan on every push and PR to `main`.

## Code map

- `lib/timer.ts`: pure timer transitions (mode switch, tick, reset, session counting), the page reducer
  (`timerReducer`: live-region announcements and the finished round) and `tabTitle`.
- `app/page.tsx` + `app/globals.css`: the page on the App shell (`app/app-shell.css`, `components/app-shell.tsx`).
- `lib/site.ts`: the site URL, title and source link.
- `lib/mcp.ts` + `app/api/mcp/route.ts`: JSON-RPC endpoint with one tool, `get_timer_modes`, that returns the real modes and durations.
- `lib/sentry.ts` + `instrumentation*.ts`: error reporting to Sentry, errors only, personal data stripped; off when
  `NEXT_PUBLIC_SENTRY_DSN` is unset.

## Related

- **Mobile App:** [bookchaowalit-pomodoro-timer-mobile](https://github.com/bookchaowalit-mobile/bookchaowalit-pomodoro-timer-mobile)
- **Portfolio:** [bookchaowalit.com](https://bookchaowalit.com)
