# 01 — Business process (As-Is / To-Be)

Pomodoro Timer คือนาฬิกาโฟกัสในเบราว์เซอร์ (Next.js) มีโหมด Focus 25 นาที, Short break 5 นาที และ Long break 15 นาที พร้อมนับรอบ Focus ที่เสร็จในหน่วยความจำ ไม่มีบัญชีหรือการเก็บข้อมูล (ข้อมูลไม่ถูกส่งออก ยกเว้นรายงานข้อผิดพลาดไป Sentry เมื่อมี DSN) มี `/api/mcp` ที่คืนโหมดและระยะเวลา และ `/api/health` สำหรับ smoke test หลัง deploy

Last reviewed: 2026-11-28 · commit `b0f8fbf`

## As-Is (จากโค้ดวันนี้)

```mermaid
flowchart TD
  V["Visitor opens page"] --> MODE["pick mode: Focus 25 / Short 5 / Long 15 min (switching pauses and loads duration)"]
  MODE --> CTRL["Start / Pause / Reset current mode"]
  CTRL -->|"Start / Resume"| TICK["setInterval 1 s + visibilitychange + one-shot timeout at the deadline (hidden tab)"]
  CTRL -->|"Pause: keeps time left"| MODE
  CTRL -->|"Reset: stops at full time; Undo restores time left if a started round was cleared"| MODE
  TICK --> TITLE["tab title shows time left"]
  TICK --> END{"round reached 0?"}
  END -->|no| TICK
  END -->|"yes: title Time is up, on-page line and polite status name round done and next mode"| NEXT{"was it Focus?"}
  NEXT -->|yes| COUNT["completed count +1 (memory only); next mode chosen automatically: Short break, every 4th focus Long break"]
  NEXT -->|"no: break"| HOLD["next mode is Focus, count unchanged"]
  COUNT --> READY["clock holds, not running, until user presses Start"]
  HOLD --> READY
  READY --> CTRL
  RELOAD["page reload"] -->|"count resets, nothing stored"| MODE
  AGENT["MCP client POST /api/mcp"] --> TOOL["tools/call get_timer_modes returns real modes and durations"]
  AGENT -->|"unknown tool -32602, unknown method -32601"| ERR["JSON-RPC error"]
  PUSH["push to main"] --> CI["ci.yml (separate from deploy)"]
  PUSH --> VERCEL["Vercel Git deploy of main (not gated by CI) [ต้องยืนยัน: ผูก Git ปัจจุบัน]"]
  VERCEL -->|"deployment_status"| SMOKE["deploy-smoke.yml: scripts/deploy-smoke.sh checks home, /api/health commit, /robots.txt Sitemap line"]
  V -.->|"runtime error"| SENTRY["Sentry: errors only; scrub drops request, user, breadcrumbs, extra, strips URL queries; off when DSN unset"]
```

Sources: `app/page.tsx`, `lib/timer.ts`, `lib/mcp.ts`, `app/api/mcp/route.ts`, `app/api/health/route.ts`, `scripts/deploy-smoke.sh`, `.github/workflows/deploy-smoke.yml`, `lib/sentry.ts`, `README.md`, `PRODUCT.md`

ข้อเท็จจริงสำคัญจากโค้ด:

- ไม่มีเสียง การแจ้งเตือนของเบราว์เซอร์ หรือประวัติรอบ: สัญญาณเมื่อจบรอบคือชื่อแท็บ "Time is up", ข้อความบนหน้า และ polite live region สำหรับโปรแกรมอ่านหน้าจอ
- การเปลี่ยนนาฬิการะบบไปข้างหน้าจำนวนมากถูกนับเป็นเวลาที่ผ่านไป (`PRODUCT.md` §Known limits)
- `/api/health` คืน commit จาก `VERCEL_GIT_COMMIT_SHA` เพื่อให้ smoke test ตรวจว่า production รันคอมมิตที่ deploy

## To-Be (ไม่มีแหล่งที่เขียนไว้)

ไม่มี To-Be ที่เขียนไว้

## Gap

| ID | As-Is → To-Be | Status | Owner | Evidence |
|---|---|---|---|---|
| G1 | ไม่มี To-Be ของกระบวนการเขียนไว้ → owner กำหนดเป้าหมาย (ฟีเจอร์/ขอบเขตถัดไป) หรือยืนยันว่า As-Is คือเป้าหมายสุดท้าย | decide | owner | ไม่มีใน `PRODUCT.md` / `README.md` / `specs/` |
