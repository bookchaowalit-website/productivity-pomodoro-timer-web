# Pomodoro Timer (Focus Fold) — Product truth

> Inferred from the code, routes and copy (no user interview). Checked against the portfolio card claims review
> (`portfolio-site-web/docs/audits/CARD-CLAIMS-REVIEW-2026-10.md`, row `pomodoro-timer`) on 2026-10-22.

## What it is

A client-side Pomodoro focus clock. One page, one clock, no account.

## Who it is for

One person working in one browser tab who wants a quiet interval timer for focus blocks and breaks.

## What works today

1. Choose Focus (25 min), Short break (5 min) or Long break (15 min). Switching mode pauses the clock and loads that
   mode's duration.
2. Start or pause the countdown; reset the current mode.
3. When a focus block ends, the completed count goes up by one and the clock holds on the next break; every fourth
   focus opens a long break. Breaks do not add to the count.
4. `/api/mcp` answers JSON-RPC with one tool, `get_timer_modes`, that returns the real modes and durations.
5. Front-end errors go to Sentry (errors only, personal data stripped) when `NEXT_PUBLIC_SENTRY_DSN` is set.

## What does not work (and must not be claimed)

- Durations are fixed. There are no custom durations.
- No session history: the completed count lives in memory and resets on reload. Nothing is stored or synced.
- No sound, ambient audio, Web Audio, browser notifications or Service Worker. The page says it sends no alerts.
- No measured load-time claim. No product analytics are live.

The portfolio card used to claim customisable durations, session history, notifications, ambient sounds, Web Audio,
Service Workers and sub-1s load; the card claims review downgraded it from Live to Prototype for this reason.

## Live URL and deploy state

- Live: https://pomodoro-timer.bookchaowalit.com (HTTP 200 on 2026-10-22).
- The Vercel project is still linked to the old repository name (`bookchaowalit/bookchaowalit-pomodoro-timer-frontend`),
  so a push to `main` does not deploy. Production runs `2b229cc` (Next.js security patch, deployed by CLI on 2026-10-23,
  owner-approved D9a), which includes Sentry and the real `get_timer_modes` MCP tool (live `/api/mcp` checked 2026-10-23).
  Later commits on `main` wait until the owner reconnects Vercel Git to this repository (owner action D9).

## Boundaries

- Browser-only; no backend apart from the stateless `/api/mcp` route.
- Mobile companion: `bookchaowalit-mobile/bookchaowalit-pomodoro-timer-mobile` (separate repository).
