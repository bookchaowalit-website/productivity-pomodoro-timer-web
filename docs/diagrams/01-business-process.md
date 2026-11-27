# 01 — Business process (As-Is / To-Be)

Pomodoro Timer คือนาฬิกาโฟกัสในเบราว์เซอร์ (Next.js) มีโหมด Focus 25 นาที, Short break 5 นาที และ Long break 15 นาที พร้อมนับรอบ Focus ที่เสร็จในหน่วยความจำ ไม่มีบัญชีหรือการเก็บข้อมูล มี `/api/mcp` ที่คืนโหมดและระยะเวลา และ `/api/health` สำหรับ smoke test หลัง deploy

Last reviewed: 2026-11-28 · commit `b0f8fbf`

## As-Is (จากโค้ดวันนี้)

```mermaid
flowchart TD
  V["Visitor opens page"] --> MODE["pick mode: Focus 25 / Short 5 / Long 15 min (switching pauses and loads duration)"]
  MODE --> CTRL["Start / Pause / Reset current mode"]
  CTRL --> TICK["setInterval 1 s + visibilitychange catch-up from real elapsed time"]
  TICK --> TITLE["tab title shows time left"]
  TICK --> END{"round reached 0?"}
  END -->|no| TICK
  END -->|"yes: title Time is up, polite status names next mode"| NEXT{"was it Focus?"}
  NEXT -->|yes| COUNT["completed count +1 (memory only); 4th focus opens Long break"]
  NEXT -->|"no: break"| HOLD["clock holds on next mode, count unchanged"]
  COUNT --> MODE
  HOLD --> MODE
  RELOAD["page reload"] -->|"count resets, nothing stored"| MODE
  AGENT["MCP client POST /api/mcp"] --> TOOL["tools/call get_timer_modes returns real modes and durations"]
  AGENT -->|"unknown tool -32602, unknown method -32601"| ERR["JSON-RPC error"]
  VERCEL["Vercel Git deploy of main"] --> SMOKE["deploy-smoke.yml: scripts/deploy-smoke.sh checks home, /api/health commit, /more-projects 308"]
  V -.->|"runtime error"| SENTRY["Sentry: errors only, personal data stripped; off when DSN unset"]
```

Sources: `app/page.tsx`, `lib/timer.ts`, `lib/mcp.ts`, `app/api/mcp/route.ts`, `app/api/health/route.ts`, `scripts/deploy-smoke.sh`, `.github/workflows/deploy-smoke.yml`, `lib/sentry.ts`, `README.md`, `PRODUCT.md`

ข้อเท็จจริงสำคัญจากโค้ด:

- ไม่มีเสียง การแจ้งเตือนของเบราว์เซอร์ หรือประวัติรอบ: สัญญาณเดียวเมื่อจบรอบคือชื่อแท็บ
- การเปลี่ยนนาฬิการะบบไปข้างหน้าจำนวนมากถูกนับเป็นเวลาที่ผ่านไป (`PRODUCT.md` §Known limits)
- `/api/health` คืน commit จาก `VERCEL_GIT_COMMIT_SHA` เพื่อให้ smoke test ตรวจว่า production รันคอมมิตที่ deploy

## To-Be (ไม่มีแหล่งที่เขียนไว้)

ไม่มี To-Be ที่เขียนไว้

## Gap

| ID | As-Is → To-Be | Status | Owner | Evidence |
|---|---|---|---|---|
| G1 | ไม่มี To-Be ของกระบวนการเขียนไว้ → owner กำหนดเป้าหมาย (ฟีเจอร์/ขอบเขตถัดไป) หรือยืนยันว่า As-Is คือเป้าหมายสุดท้าย | decide | owner | ไม่มีใน `PRODUCT.md` / `README.md` / `specs/` |
