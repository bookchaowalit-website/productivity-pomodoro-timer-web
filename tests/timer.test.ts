import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { MODES, initialTimer, initialView, chooseMode, tickTimer, resetTimer, clock, tabTitle, timerReducer } from "../lib/timer.ts";

afterEach(() => { vi.useRealTimers(); });

test("switching modes pauses the clock and resets the selected duration", () => {
  const state = { ...initialTimer(), active: true, remaining: 4, sessions: 2 };
  for (const mode of ["work", "shortBreak", "longBreak"] as const) {
    assert.deepEqual(chooseMode(state, mode), { mode, remaining: MODES[mode].duration, active: false, sessions: 2 });
  }
});
test("fake interval ticks count down and stop when paused", () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  let state = { ...initialTimer(), active: true, remaining: 3 };
  const interval = setInterval(() => { state = tickTimer(state); }, 1000);
  vi.advanceTimersByTime(2000);
  assert.equal(state.remaining, 1);
  state = { ...state, active: false };
  vi.advanceTimersByTime(10000);
  assert.equal(state.remaining, 1);
  assert.equal(state.sessions, 0);
  clearInterval(interval);
});
test("a completed focus increments once and holds the next break", () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  let state = { ...initialTimer(), active: true, remaining: 1 };
  const interval = setInterval(() => { state = tickTimer(state); }, 1000);
  vi.advanceTimersByTime(1000);
  assert.deepEqual(state, { mode: "shortBreak", remaining: 300, active: false, sessions: 1 });
  vi.advanceTimersByTime(5000);
  assert.equal(state.sessions, 1);
  clearInterval(interval);
});
test("each fourth focus chooses a long break and breaks do not add sessions", () => {
  const state = tickTimer({ mode: "work", remaining: 1, active: true, sessions: 3 });
  assert.deepEqual(state, { mode: "longBreak", remaining: 900, active: false, sessions: 4 });
  for (const mode of ["shortBreak", "longBreak"] as const) {
    assert.deepEqual(tickTimer({ ...state, mode, remaining: 1, active: true }), { mode: "work", remaining: 1500, active: false, sessions: 4 });
  }
});
test("reset holds the current mode and preserves session count", () => {
  assert.deepEqual(resetTimer({ mode: "shortBreak", remaining: 2, active: true, sessions: 4 }), { mode: "shortBreak", remaining: 300, active: false, sessions: 4 });
  assert.equal(clock(1500), "25:00");
  assert.equal(clock(61), "01:01");
  assert.equal(clock(0), "00:00");
});

test("the page reducer announces mode changes and round ends, never plain ticks", () => {
  let view = initialView();
  assert.equal(timerReducer(view, { type: "tick", now: 0 }), view); // held clock: same object
  view = timerReducer(view, { type: "choose", mode: "shortBreak", now: 0 });
  assert.equal(view.announcement, "Short break selected, 05:00.");
  view = timerReducer(view, { type: "toggle", now: 0 });
  assert.equal(view.timer.active, true);
  assert.equal(view.endsAt, 300_000);
  assert.equal(view.announcement, ""); // Start clears it
  const ticked = timerReducer(view, { type: "tick", now: 1000 });
  assert.equal(ticked.timer.remaining, 299);
  assert.equal(timerReducer(ticked, { type: "tick", now: 1500 }), ticked); // same second: same object
  const ended = timerReducer(view, { type: "tick", now: 300_000 });
  assert.equal(ended.finished, "shortBreak");
  assert.equal(ended.timer.mode, "work");
  assert.match(ended.announcement, /^Short break finished\. Focus is ready, 25:00\./);
  assert.equal(timerReducer(ended, { type: "reset", now: 0 }).finished, null);
  assert.equal(timerReducer(ended, { type: "toggle", now: 0 }).finished, null);
});

test("the tab title shows time left while running and time is up after a round", () => {
  const base = initialView();
  assert.equal(tabTitle(base, "T"), "T");
  assert.equal(tabTitle({ ...base, timer: { ...base.timer, active: true, remaining: 61 } }, "T"), "01:01 Focus · T");
  assert.equal(tabTitle({ ...base, finished: "work" }, "T"), "Time is up: Focus done · T");
});

test("start, pause and reset clear the announcement; picking the same mode says it again", () => {
  let view = timerReducer(initialView(), { type: "choose", mode: "work", now: 0 });
  assert.equal(view.announcement, "Focus selected, 25:00.");
  const again = timerReducer(view, { type: "choose", mode: "work", now: 0 });
  assert.notEqual(again.announcement, view.announcement);
  assert.equal(again.announcement.trim(), "Focus selected, 25:00.");
  assert.equal(timerReducer(again, { type: "choose", mode: "work", now: 0 }).announcement, "Focus selected, 25:00.");
  view = timerReducer(timerReducer(view, { type: "toggle", now: 0 }), { type: "tick", now: 1_500_000 });
  assert.match(view.announcement, /Press Start/);
  assert.equal(timerReducer(view, { type: "toggle", now: 0 }).announcement, "");
  assert.equal(timerReducer(view, { type: "reset", now: 0 }).announcement, "");
});

test("time left comes from the clock reading, so late or missing ticks cannot drift", () => {
  let view = timerReducer(initialView(), { type: "toggle", now: 10_000 });
  view = timerReducer(view, { type: "tick", now: 10_000 + 7 * 60_000 + 400 }); // one tick after 7 minutes
  assert.equal(view.timer.remaining, 18 * 60);
  view = timerReducer(view, { type: "toggle", now: 10_000 + 8 * 60_000 }); // pause keeps the wall-clock time left
  assert.deepEqual([view.timer.active, view.timer.remaining, view.endsAt], [false, 17 * 60, null]);
  view = timerReducer(view, { type: "tick", now: 10_000 + 60 * 60_000 }); // paused: nothing moves
  assert.equal(view.timer.remaining, 17 * 60);
  view = timerReducer(view, { type: "toggle", now: 1_000_000 });
  const late = timerReducer(view, { type: "tick", now: 1_000_000 + 3 * 60 * 60_000 }); // hours late
  assert.deepEqual(late.timer, { mode: "shortBreak", remaining: 300, active: false, sessions: 1 });
  assert.equal(late.finished, "work");
  // Pause pressed after the end but before a tick: the round ends and counts, nothing freezes at 00:01.
  const pausedLate = timerReducer(view, { type: "toggle", now: 1_000_000 + 99 * 60_000 });
  assert.deepEqual(pausedLate.timer, { mode: "shortBreak", remaining: 300, active: false, sessions: 1 });
  assert.equal(pausedLate.finished, "work");
  assert.match(pausedLate.announcement, /^Focus finished\./);
  const pausedExact = timerReducer(view, { type: "toggle", now: 1_000_000 + 17 * 60_000 }); // exactly at the end (17 min were left)
  assert.equal(pausedExact.timer.sessions, 1);
  const pausedBefore = timerReducer(view, { type: "toggle", now: 1_000_000 + 17 * 60_000 - 1 });
  assert.deepEqual([pausedBefore.timer.mode, pausedBefore.timer.remaining, pausedBefore.timer.sessions], ["work", 1, 0]);
});

test("Reset or a mode pick after time ran out (before a tick) still counts the finished round", () => {
  const running = timerReducer(initialView(), { type: "toggle", now: 0 });
  const end = 25 * 60_000;
  const reset = timerReducer(running, { type: "reset", now: end + 10 });
  assert.deepEqual(reset.timer, { mode: "shortBreak", remaining: 300, active: false, sessions: 1 });
  const picked = timerReducer(running, { type: "choose", mode: "work", now: end + 10 });
  assert.deepEqual(picked.timer, { mode: "work", remaining: 1500, active: false, sessions: 1 });
  assert.equal(picked.announcement, "Focus selected, 25:00.");
  // Before the end nothing is counted.
  assert.equal(timerReducer(running, { type: "reset", now: end - 1 }).timer.sessions, 0);
  assert.equal(timerReducer(running, { type: "choose", mode: "longBreak", now: end - 1 }).timer.sessions, 0);
});

test("cycleMarks keeps 4 of 4 during the long break a full cycle opened", async () => {
  const { cycleMarks } = await import("../lib/timer.ts");
  assert.equal(cycleMarks({ mode: "longBreak", remaining: 900, active: false, sessions: 4 }), 4);
  assert.equal(cycleMarks({ mode: "work", remaining: 1500, active: false, sessions: 4 }), 0);
  assert.equal(cycleMarks({ mode: "longBreak", remaining: 900, active: false, sessions: 0 }), 0);
  assert.equal(cycleMarks({ mode: "shortBreak", remaining: 300, active: false, sessions: 3 }), 3);
});

test("interruptedRound returns the started round paused, and null when nothing would be lost", async () => {
  const { interruptedRound } = await import("../lib/timer.ts");
  const fresh = initialView();
  assert.equal(interruptedRound(fresh, 0), null);
  const running = timerReducer(fresh, { type: "toggle", now: 0 });
  assert.deepEqual(interruptedRound(running, 623_000), { mode: "work", remaining: 877, active: false, sessions: 0 });
  assert.equal(interruptedRound(running, 1_500_000), null); // time ran out: the round is counted, not lost
  const restored = timerReducer(running, { type: "restore", timer: { mode: "work", remaining: 877, active: true, sessions: 0 } });
  assert.deepEqual(restored.timer, { mode: "work", remaining: 877, active: false, sessions: 0 });
  assert.equal(restored.endsAt, null);
  assert.match(restored.announcement, /Focus restored, 14:37 left, paused/);
});

test("finishedLine names the round that ended and the one that is ready", async () => {
  const { finishedLine } = await import("../lib/timer.ts");
  assert.equal(finishedLine(initialView()), "");
  const ended = timerReducer(timerReducer(initialView(), { type: "toggle", now: 0 }), { type: "tick", now: 1_500_000 });
  assert.equal(finishedLine(ended), "Focus done — Short break is ready");
});
