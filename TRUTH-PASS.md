# Truth-pass (BD-028) — bookchaowalit-pomodoro-timer-frontend

**Date:** 2026-08-11  
**Tier:** B (showcase)  
**Title (from README):** Pomodoro Timer (Focus Fold)

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
Tests signal: yes (2026-10-22: `npm test`, 3 node:test files, shared CI)

## Claim classes

| Claim | Class |
|---|---|
| README describes purpose | Observed |
| Local install + dev server works on this machine | Planned (not re-verified this pass) |
| Production users / revenue | **Not claimed** |
| Store / public SLA | **Not claimed** |

## Limitations (honest)

- Tests cover the timer transitions, the MCP handler and the Sentry scrubbing; there is no browser/E2E test.
- PRODUCT.md is inferred from the code, not from a user interview.

## Do not

- Inflate metrics or invent live customer counts
- Promote website empty twins over canonical game/products owners
- Bulk-commit unrelated dirty files without review
