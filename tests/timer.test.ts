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
  assert.equal(timerReducer(view, { type: "tick" }), view); // held clock: same object
  view = timerReducer(view, { type: "choose", mode: "shortBreak" });
  assert.equal(view.announcement, "Short break selected, 05:00.");
  view = timerReducer(view, { type: "toggle" });
  assert.equal(view.timer.active, true);
  const ticked = timerReducer(view, { type: "tick" });
  assert.equal(ticked.timer.remaining, 299);
  assert.equal(ticked.announcement, view.announcement);
  const ended = timerReducer({ ...view, timer: { ...view.timer, remaining: 1 } }, { type: "tick" });
  assert.equal(ended.finished, "shortBreak");
  assert.equal(ended.timer.mode, "work");
  assert.match(ended.announcement, /^Short break finished\. Focus is ready, 25:00\./);
  assert.equal(timerReducer(ended, { type: "reset" }).finished, null);
  assert.equal(timerReducer(ended, { type: "toggle" }).finished, null);
});

test("the tab title shows time left while running and time is up after a round", () => {
  const base = initialView();
  assert.equal(tabTitle(base, "T"), "T");
  assert.equal(tabTitle({ ...base, timer: { ...base.timer, active: true, remaining: 61 } }, "T"), "01:01 Focus · T");
  assert.equal(tabTitle({ ...base, finished: "work" }, "T"), "Time is up: Focus done · T");
});
