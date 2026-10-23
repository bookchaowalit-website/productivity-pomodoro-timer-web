---
title: "SPEC-001 — Shared CI, Sentry, a real MCP tool and truthful docs"
status: implemented
tags: [spec, sdd, tdd, ci, sentry, mcp, docs]
created: 2026-10-22
updated: 2026-10-23
description: "Add the shared CI and security scan, report front-end errors to Sentry without personal data, replace the template MCP route with a tested tool that returns the real timer modes, and make README/PRODUCT/TRUTH-PASS match the code."
---

# SPEC-001 — Shared CI, Sentry, a real MCP tool and truthful docs

Standard: ADR-0004 (TDD + SDD). Plan: Big Loop, b-tier-b wave (target L3). Roadmap: `tier-b-showcase.yaml` pom-t2, pom-t4, pom-t7.

## Document control

| Field | Value |
|---|---|
| Spec ID / version | SPEC-001 / 1.0 |
| Status | implemented |
| Repository | bookchaowalit-website/productivity-pomodoro-timer-web |
| Owner (maker) | Claude Code (b-tier-b repo agent) |
| Approver | Owner (bookchaowalit) |

## 1. Problem and intent

- **Problem:** no CI workflow at all; one test file; no error reporting; `app/api/mcp/route.ts` was a template whose only
  tool returned `{ message: "Sample data" }`; README was `create-next-app` boilerplate; TRUTH-PASS recorded the title as
  "or"; a stray `app/page.tsx.backup` was tracked; the portfolio card claimed features the app does not have.
- **Outcome:** every push and PR to `main` runs the shared Node CI (lint, typecheck, tests, build) and the shared security
  scan, fail-closed; browser/server errors reach Sentry with personal data stripped; `/api/mcp` returns real data; the
  docs say what the app does and does not do.

## 2. Behaviour — acceptance criteria

| AC | Given / When / Then | Test |
|---|---|---|
| AC-01 | Sentry is off when `NEXT_PUBLIC_SENTRY_DSN` is unset or empty | `tests/sentry.test.ts` "stays disabled" |
| AC-02 | With a DSN: errors only (no PII, tracing, trace headers, breadcrumbs, transactions) | `tests/sentry.test.ts` "reports errors only" |
| AC-03 | Before send, request, user, breadcrumbs, extra and stack-frame locals are removed | `tests/sentry.test.ts` "scrubEvent …" (2 tests) |
| AC-03b | Only platform contexts (os, runtime, browser, device, app) are kept, so `contexts.nextjs.request_path` is dropped; query strings are stripped from `transaction` and tags, and the `url` tag is removed (security review 2026-10-23) | `tests/sentry.test.ts` "drops the request path …" (red against the old scrubber, then green) |
| AC-04 | `initialize` returns server info; `tools/list` advertises only `get_timer_modes` | `tests/mcp.test.ts` |
| AC-05 | `tools/call get_timer_modes` returns Focus 25, Short break 5, Long break 15 min and long break every 4 (read from `lib/timer.ts`) | `tests/mcp.test.ts` "returns the real mode durations" |
| AC-06 | Unknown tool → -32602, unknown method → -32601, malformed request → -32600, notification → no reply, bad JSON → 400 -32700 | `tests/mcp.test.ts`; parse error checked by hand on the local build (`curl -d x` → 400) |
| AC-07 | Timer behaviour unchanged (long-break cadence now uses the shared `LONG_BREAK_EVERY` constant) | `tests/timer.test.ts` (5 existing fake-timer tests) |
| AC-08 | CI runs lint, typecheck, `npm test`, `next build` and the security scan, and fails on any of them | `.github/workflows/ci.yml` run on `main` |

## 3. Red-first evidence

- `tests/sentry.test.ts` written first: `npm test` failed with `ERR_MODULE_NOT_FOUND … lib/sentry.ts` (5 timer tests passed, 1 file failed).
- `tests/mcp.test.ts` written first: failed with `ERR_MODULE_NOT_FOUND … lib/mcp.ts`.
- After implementation: `npm test` → 14 tests, 14 pass, 0 fail (3 files). `npm run lint` 0 errors (1 existing warning in
  `app/more-projects/page.tsx`), `npm run typecheck` clean, `npm run build` passes.

## 4. Interfaces and data

| Area | Change |
|---|---|
| `package.json` | `@sentry/nextjs` ^11.8.0 (lockfile regenerated with npm 10 so `npm ci` works on Node 22) |
| `lib/sentry.ts`, `instrumentation.ts`, `instrumentation-client.ts` | Sentry init for browser, Node and Edge; DSN from `NEXT_PUBLIC_SENTRY_DSN`; no `withSentryConfig`, no source-map upload |
| `lib/mcp.ts`, `app/api/mcp/route.ts` | typed JSON-RPC handler; one tool `get_timer_modes`; no user data |
| `lib/timer.ts` | exports `LONG_BREAK_EVERY = 4` (was an inline literal) |
| `.github/workflows/ci.yml` | new; shared `ci-node.yml` + `security.yml` pinned to v1.1.1 (`87dc5e1`), GitHub-hosted (public repo) |
| docs | README rewritten; PRODUCT.md states what works / does not / deploy state; TRUTH-PASS title and test signal fixed; `docs/measurement/KPI-PLAN.md` added; `app/page.tsx.backup` deleted |

## 5. UI review sign-off

No rendered UI or copy changed (the page, layout and CSS are untouched). Regression pass on the final local production
build (`next start`), home page at 375 / 768 / 1440: HTTP 200, 0 horizontal overflow, 0 console errors. Looked at each
image: layout, clock, buttons, mode rail and session marks render as before. One pre-existing nit, not changed here: at
375 px the rotated "LOCAL 00 NO ALERTS" stamp touches the end of the intro paragraph. Screenshots:
`/tmp/claude-1000/-home-bookchaowalit/b5bfc9a8-5563-43ed-8bab-0f8a2c2422e1/scratchpad/shots/productivity-pomodoro-timer-web/`.

## 6. Out of scope

- Custom durations, history, sound or notifications (not built; the docs now say so).
- README screenshot (pom-t3), axe accessibility pass (pom-t5), the 375 px stamp overlap, the 978-line
  `app/more-projects/page.tsx`, the Edge-runtime deprecation warning on `/api/mcp`.
- Product analytics (PostHog, owner decision D4).

## 7. Deployment state

- No deploy from this change itself. The Vercel project is linked to the old repo name, so pushes to `main` create no
  deployment. On 2026-10-23 the owner approved a one-off CLI deploy of the Next.js security patch (D9a): production now
  runs `2b229cc`, which contains everything in this spec (live `/api/mcp` `tools/list` returns `get_timer_modes`).
  Later commits wait for the owner to reconnect Vercel Git (D9). `deploy_workflow` stays a scorecard gap for that
  reason; no deploy job was added.
- Still to confirm: Sentry receives a test error from the live site.
