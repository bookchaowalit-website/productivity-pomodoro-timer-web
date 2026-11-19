export type Mode = "work" | "shortBreak" | "longBreak";

export const MODES: Record<Mode, { label: string; short: string; duration: number; note: string }> = {
  work: { label: "Focus", short: "WORK", duration: 25 * 60, note: "one clear block" },
  shortBreak: { label: "Short break", short: "PAUSE", duration: 5 * 60, note: "step away" },
  longBreak: { label: "Long break", short: "RESET", duration: 15 * 60, note: "let the day widen" },
};

export const LONG_BREAK_EVERY = 4;

export function clock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * `cycleDone` is set only on the long break that the fourth focus block of a cycle opened, so
 * the marks show 4 of 4 during that break and not during a long break picked by hand.
 */
export type TimerState = { mode: Mode; remaining: number; active: boolean; sessions: number; cycleDone?: true };
export function initialTimer(): TimerState {
  return { mode: "work", remaining: MODES.work.duration, active: false, sessions: 0 };
}
export function chooseMode(state: TimerState, mode: Mode): TimerState {
  const { cycleDone, ...rest } = state;
  const next: TimerState = { ...rest, mode, remaining: MODES[mode].duration, active: false };
  // Resetting the long break a full cycle opened keeps it that break; any other pick drops the flag.
  if (cycleDone && mode === state.mode) next.cycleDone = true;
  return next;
}
export function resetTimer(state: TimerState): TimerState {
  return chooseMode(state, state.mode);
}
export function tickTimer(state: TimerState): TimerState {
  if (!state.active) return state;
  if (state.remaining > 1) return { ...state, remaining: state.remaining - 1 };
  const sessions = state.sessions + (state.mode === "work" ? 1 : 0);
  const mode = state.mode === "work" ? (sessions % LONG_BREAK_EVERY === 0 ? "longBreak" : "shortBreak") : "work";
  const next: TimerState = { mode, remaining: MODES[mode].duration, active: false, sessions };
  if (state.mode === "work" && mode === "longBreak") next.cycleDone = true;
  return next;
}

/**
 * Page state: the timer plus what to tell the person. `announcement` feeds a polite live region
 * and changes only when the mode changes (picked or at the end of a round), never on each tick.
 * `finished` names the round that just ended until the person acts again; the page shows it in
 * the tab title so someone in another tab can see that time is up (no sound, no notifications).
 */
export type TimerView = { timer: TimerState; announcement: string; finished: Mode | null; endsAt: number | null };
/**
 * `now` is performance.now() in ms: a monotonic clock, so changing the system clock cannot add or
 * remove time. While running, `endsAt` is the start reading plus the time left at start, and every
 * tick derives the time left from it instead of counting interval callbacks: a background tab
 * throttles setInterval, so counting would lag and "Time is up" could come minutes late.
 */
/**
 * Start and Pause are separate actions that match the label the person saw: a Pause that lands
 * after a tick already ended the round (a tab coming back into view) must not start the next one.
 */
export type TimerAction = { type: "tick"; now: number } | { type: "start"; now: number } | { type: "pause"; now: number } | { type: "reset"; now: number } | { type: "choose"; mode: Mode; now: number } | { type: "restore"; timer: TimerState };

export function initialView(): TimerView {
  return { timer: initialTimer(), announcement: "", finished: null, endsAt: null };
}

function secondsLeft(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/**
 * A live region only speaks when its text changes, so the same message twice in a row (picking
 * the mode that is already selected) gets a trailing no-break space to be read again.
 */
function fresh(previous: string, message: string): string {
  return previous === message ? `${message}\u00a0` : message;
}

/** The round is over (however late we noticed): the last-second transition ends and counts it. */
function finishRound(view: TimerView): TimerView {
  const timer = tickTimer({ ...view.timer, active: true, remaining: 1 });
  const ended = view.timer.mode;
  return {
    timer,
    endsAt: null,
    finished: ended,
    announcement: fresh(view.announcement, `${MODES[ended].label} finished. ${MODES[timer.mode].label} is ready, ${clock(timer.remaining)}. Press Start when you are.`),
  };
}

function timeIsUp(view: TimerView, now: number): boolean {
  return view.timer.active && view.endsAt !== null && secondsLeft(view.endsAt, now) === 0;
}

export function timerReducer(view: TimerView, action: TimerAction): TimerView {
  switch (action.type) {
    case "tick": {
      if (!view.timer.active || view.endsAt === null) return view;
      const left = secondsLeft(view.endsAt, action.now);
      if (left === 0) return finishRound(view);
      if (left === view.timer.remaining) return view;
      return { ...view, timer: { ...view.timer, remaining: left } };
    }
    // Start and Pause are not announced; they clear an old "press Start" message.
    case "start": {
      if (view.timer.active) return view; // already running: a second Start changes nothing
      return { timer: { ...view.timer, active: true }, endsAt: action.now + view.timer.remaining * 1000, finished: null, announcement: "" };
    }
    case "pause": {
      // Stopped already (a tick just ended the round): Pause never starts the next one.
      if (!view.timer.active) return view;
      if (view.endsAt === null) return { ...view, timer: { ...view.timer, active: false }, finished: null, announcement: "" };
      const left = secondsLeft(view.endsAt, action.now);
      // Pause pressed after time ran out but before a tick noticed: end and count the round.
      if (left === 0) return finishRound(view);
      return { timer: { ...view.timer, active: false, remaining: left }, endsAt: null, finished: null, announcement: "" };
    }
    // Reset and mode picks first end a round whose time already ran out, so a finished focus block
    // is still counted, then act on the state that follows. When they throw away a started round,
    // the live region says so and that Undo can bring it back (the page shows the Undo toast).
    case "reset": {
      // Time already ran out (a tick just had not noticed): the result is the same as when the tick came first,
      // the round ends and counts and the "Time is up" signal stays (the next round is already fresh, so Reset
      // has nothing more to clear).
      if (timeIsUp(view, action.now)) return finishRound(view);
      const lost = interruptedRound(view, action.now);
      return { timer: resetTimer(view.timer), endsAt: null, finished: null, announcement: lost ? fresh(view.announcement, clearedLine(lost)) : "" };
    }
    case "choose": {
      const lost = interruptedRound(view, action.now);
      const current = timeIsUp(view, action.now) ? finishRound(view) : view;
      const timer = chooseMode(current.timer, action.mode);
      const picked = `${MODES[action.mode].label} selected, ${clock(timer.remaining)}.`;
      return { timer, endsAt: null, finished: null, announcement: fresh(current.announcement, lost ? `${picked} ${clearedLine(lost)}` : picked) };
    }
    // Undo of a Reset or mode pick: the round comes back paused where it was.
    case "restore": {
      const timer = { ...action.timer, active: false };
      return { timer, endsAt: null, finished: null, announcement: fresh(view.announcement, `${MODES[timer.mode].label} restored, ${clock(timer.remaining)} left, paused.`) };
    }
  }
}

/** What the live region says when a started round is cleared: the round, the time left, and Undo. */
export function clearedLine(lost: TimerState): string {
  return `${MODES[lost.mode].label} round cleared at ${clock(lost.remaining)}. Undo is available until you start the next round.`;
}

/**
 * The round a Reset or mode pick is about to throw away, paused at the time left now, or null when
 * nothing would be lost (the round has not started, or its time already ran out and it is counted).
 */
export function interruptedRound(view: TimerView, now: number): TimerState | null {
  if (timeIsUp(view, now)) return null;
  const { timer } = view;
  const remaining = timer.active && view.endsAt !== null ? secondsLeft(view.endsAt, now) : timer.remaining;
  if (remaining >= MODES[timer.mode].duration) return null;
  return { ...timer, active: false, remaining };
}

/**
 * Filled session marks: focus blocks done in this cycle. During the long break that a full cycle
 * opened (and only that one), all marks stay filled (4 of 4) until the break ends.
 */
export function cycleMarks(timer: TimerState): number {
  return timer.cycleDone && timer.mode === "longBreak" ? LONG_BREAK_EVERY : timer.sessions % LONG_BREAK_EVERY;
}

/** The visible line after a round ends: what finished and what is ready next. */
export function finishedLine(view: TimerView): string {
  return view.finished ? `${MODES[view.finished].label} done — ${MODES[view.timer.mode].label} is ready` : "";
}

/** Tab title: the time left while running, a plain "time is up" after a round, else the site title. */
export function tabTitle(view: TimerView, siteTitle: string): string {
  const { timer, finished } = view;
  if (timer.active) return `${clock(timer.remaining)} ${MODES[timer.mode].label} · ${siteTitle}`;
  if (finished) return `Time is up: ${MODES[finished].label} done · ${siteTitle}`;
  return siteTitle;
}

/**
 * The timer's clock: performance.now() (monotonic, so changing the system clock cannot add or remove
 * time), plus any time the device slept. Some browsers (Chromium on Linux) stop performance.now() during
 * sleep, so a round whose deadline passed while the lid was shut would otherwise still show time left.
 * When the wall clock moved more than two seconds further than the monotonic one between two readings,
 * that gap is added from then on. A backward wall-clock change (or a small NTP step) is ignored; a large
 * forward change of the system clock cannot be told apart from sleep and counts too.
 */
export function createSleepAwareClock(mono: () => number = () => performance.now(), wall: () => number = () => Date.now()) {
  let lastMono = mono();
  let lastWall = wall();
  let slept = 0;
  function now(): number {
    const m = mono();
    const w = wall();
    const gap = w - lastWall - (m - lastMono);
    if (gap > 2000) slept += gap;
    lastMono = m;
    lastWall = w;
    return m + slept;
  }
  /** Total sleep added so far: when it grows, timers scheduled before the sleep must be set again. */
  return Object.assign(now, { slept: () => slept });
}
