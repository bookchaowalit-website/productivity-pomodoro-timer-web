# Truth-pass (BD-028) — bookchaowalit-pomodoro-timer-frontend

**Date:** 2026-08-11  
**Tier:** B (showcase)  
**Title (from README):** Pomodoro Timer

## Who / problem

See README for product narrative. This file records an honest portfolio claim class only.

## How to run

```bash
# From this repository root
npm install   # or npm ci if lockfile present
npm run dev
# production build (if available)
npm run build
```

Package name: `bookchaowalit-pomodoro-timer-frontend`  
Scripts seen: dev, build, start, lint  
Docker marker: no  
Tests signal: yes (2026-11-18: `npm test` runs vitest, including mounted happy-dom page tests; shared CI)

## Claim classes

| Claim | Class |
|---|---|
| README describes purpose | Observed |
| Local install + dev server works on this machine | Planned (not re-verified this pass) |
| Production users / revenue | **Not claimed** |
| Store / public SLA | **Not claimed** |

## Limitations (honest)

- Tests cover the timer transitions, the mounted page (happy-dom), the MCP handler and the Sentry scrubbing; there is
  no real-browser E2E test (2026-11-18 screenshots at 320–1440 px light and dark were checked by hand).
- PRODUCT.md is inferred from the code, not from a user interview.

## Do not

- Inflate metrics or invent live customer counts
- Promote website empty twins over canonical game/products owners
- Bulk-commit unrelated dirty files without review
