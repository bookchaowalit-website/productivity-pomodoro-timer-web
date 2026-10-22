---
title: "Pomodoro Timer — KPI and Instrumentation Plan"
status: draft
created: 2026-10-22
updated: 2026-10-22
description: "What would show that the Pomodoro timer is used and works, which events are planned, and what is live today (only Sentry)."
template: architecture-docs templates/sdlc/kpi-and-instrumentation-plan.md
---

# Pomodoro Timer — KPI and Instrumentation Plan

## Document control

| Field | Value |
|---|---|
| Product | bookchaowalit-website/productivity-pomodoro-timer-web (https://pomodoro-timer.bookchaowalit.com) |
| Version / status | 0.1 / **draft** — definitions only; no analytics is live, no baselines |
| Metric owner | Owner (bookchaowalit) |
| AI maker | Claude Code (b-tier-b wave, 2026-10-22) |
| AI reviewer | not reviewed yet |
| Charter objectives | OBJ-01 below (Tier B showcase; no charter document) |
| Analytics source of truth | **None live.** Product analytics (PostHog) waits on owner decision D4. `@vercel/analytics` is a dependency but is not mounted in `app/layout.tsx`. Sentry (org `personal-yu0`, project `productivity-pomodoro-timer-web`) is the only live signal, and only once production is redeployed from `main` (D9). |
| Dashboard | none |
| Next review | 2026-11-15 (Milestone M1) |

## KPI tree

```text
OBJ-01 A visitor can run a full focus block in the browser without errors
  └─ KPI-O-01 Focus completion rate: focus blocks completed / focus blocks started
       ├─ KPI-L-01 Start rate: sessions with timer_started / sessions with a page view
       ├─ KPI-L-02 Cycle depth: share of sessions that reach a long break (4 focus blocks)
       └─ KPI-G-01 Front-end error rate: sessions with a Sentry error / sessions (must stay low)
```

## KPI definitions

| KPI ID | Type | Name | Formula | Unit | Min volume | Source and events | Baseline | Target | Alert | Cadence | Owner |
|---|---|---|---|---|---|---|---|---|---|---|---|
| KPI-O-01 | outcome | Focus completion rate | `focus_completed` / `timer_started` (mode = work) | % | ≥ 100 starts / period | planned events | not yet measured | set after baseline | — | monthly | Owner |
| KPI-L-01 | leading | Start rate | sessions with `timer_started` / sessions with page view | % | ≥ 200 sessions | planned events | not yet measured | set after baseline | — | monthly | Owner |
| KPI-L-02 | leading | Cycle depth | sessions with `long_break_reached` / sessions with `focus_completed` | % | ≥ 100 | planned events | not yet measured | set after baseline | — | monthly | Owner |
| KPI-G-01 | guardrail | Front-end error rate | sessions with a Sentry error / sessions | % | ≥ 200 sessions | Sentry (live after D9 redeploy) + session count (needs analytics) | not yet measured | < 1% | any new unhandled error issue | weekly | Owner |

Below the minimum volume a rate is reported as "not measurable". Today every KPI is not measurable: there are no events.

## Event and data specification

| Event | Trigger | Properties | Personal data? | Emitted by | Status |
|---|---|---|---|---|---|
| `timer_started` | Start clock pressed | `mode` | no | frontend | planned (needs D4) |
| `focus_completed` | A work countdown reaches 0 (`tickTimer` moves work → break) | `sessions` (count in this page load) | no | frontend | planned (needs D4) |
| `long_break_reached` | `tickTimer` opens a long break | `sessions` | no | frontend | planned (needs D4) |
| `mode_selected` | Mode row pressed | `mode` | no | frontend | planned (needs D4) |
| Sentry error event | Unhandled error in browser, Node or Edge runtime | stack trace only; request, user, breadcrumbs, extra and frame locals are stripped (`lib/sentry.ts`) | no | Sentry SDK | implemented on `main`, not yet deployed (D9) |

Privacy: no names, emails, free text or IDs. Events carry only the mode and a session counter. If an analytics vendor
sets a cookie or device ID, that is personal data under PDPA and needs a consent decision first (part of D4).

## Dashboards and alerts

| Dashboard / alert | KPIs | Location | Status |
|---|---|---|---|
| Sentry issue alerts | KPI-G-01 | Sentry project `productivity-pomodoro-timer-web` | planned (project exists; alert rule not set) |
| Product dashboard | KPI-O-01, KPI-L-01, KPI-L-02 | — | planned (needs D4) |

## Instrumentation verification (before G10)

| # | Check | Result |
|---|---|---|
| 1 | Events fire once per action | not run: no events implemented |
| 2 | Counts reconcile | not applicable: no system of record (state is in memory) |
| 3 | No PII in payloads | Sentry scrubbing unit-tested (`tests/sentry.test.ts`); analytics not implemented |
| 4 | Dashboard renders | not set up |
| 5 | Alerts fire | not set up |
| 6 | Baselines captured | waived — dated action: capture 30 days of baseline after D4 and D9, review 2026-12-31 |
| 7 | Consent respected | not applicable until analytics exists |

## Change history of definitions

| Date | KPI ID | Change | Reason | Baseline restated? | Approved by |
|---|---|---|---|---|---|
| 2026-10-22 | all | First draft | Big Loop L3 | no | pending owner |
