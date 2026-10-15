import assert from "node:assert/strict";
import { test } from "node:test";
import { MODES, initialTimer, chooseMode, tickTimer, resetTimer, clock } from "../lib/timer.ts";

test("switching modes pauses the clock and resets the selected duration", () => {
  const state = { ...initialTimer(), active: true, remaining: 4, sessions: 2 };
  for (const mode of ["work", "shortBreak", "longBreak"] as const) {
    assert.deepEqual(chooseMode(state, mode), { mode, remaining: MODES[mode].duration, active: false, sessions: 2 });
  }
});
test("fake interval ticks count down and stop when paused", t => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let state = { ...initialTimer(), active: true, remaining: 3 };
  const interval = setInterval(() => { state = tickTimer(state); }, 1000);
  t.mock.timers.tick(2000);
  assert.equal(state.remaining, 1);
  state = { ...state, active: false };
  t.mock.timers.tick(10000);
  assert.equal(state.remaining, 1);
  assert.equal(state.sessions, 0);
  clearInterval(interval);
});
test("a completed focus increments once and holds the next break", t => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let state = { ...initialTimer(), active: true, remaining: 1 };
  const interval = setInterval(() => { state = tickTimer(state); }, 1000);
  t.mock.timers.tick(1000);
  assert.deepEqual(state, { mode: "shortBreak", remaining: 300, active: false, sessions: 1 });
  t.mock.timers.tick(5000);
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
