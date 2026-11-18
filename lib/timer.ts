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

export type TimerState = { mode: Mode; remaining: number; active: boolean; sessions: number };
export function initialTimer(): TimerState {
  return { mode: "work", remaining: MODES.work.duration, active: false, sessions: 0 };
}
export function chooseMode(state: TimerState, mode: Mode): TimerState {
  return { ...state, mode, remaining: MODES[mode].duration, active: false };
}
export function resetTimer(state: TimerState): TimerState {
  return chooseMode(state, state.mode);
}
export function tickTimer(state: TimerState): TimerState {
  if (!state.active) return state;
  if (state.remaining > 1) return { ...state, remaining: state.remaining - 1 };
  const sessions = state.sessions + (state.mode === "work" ? 1 : 0);
  const mode = state.mode === "work" ? (sessions % LONG_BREAK_EVERY === 0 ? "longBreak" : "shortBreak") : "work";
  return { mode, remaining: MODES[mode].duration, active: false, sessions };
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
export type TimerAction = { type: "tick"; now: number } | { type: "toggle"; now: number } | { type: "reset"; now: number } | { type: "choose"; mode: Mode; now: number };

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
    // Start, Pause and Reset are not announced; they clear an old "press Start" message.
    case "toggle": {
      if (view.timer.active) {
        if (view.endsAt === null) return { ...view, timer: { ...view.timer, active: false }, finished: null, announcement: "" };
        const left = secondsLeft(view.endsAt, action.now);
        // Pause pressed after time ran out but before a tick noticed: end and count the round.
        if (left === 0) return finishRound(view);
        return { timer: { ...view.timer, active: false, remaining: left }, endsAt: null, finished: null, announcement: "" };
      }
      return { timer: { ...view.timer, active: true }, endsAt: action.now + view.timer.remaining * 1000, finished: null, announcement: "" };
    }
    // Reset and mode picks first end a round whose time already ran out, so a finished focus block
    // is still counted, then act on the state that follows.
    case "reset": {
      const current = timeIsUp(view, action.now) ? finishRound(view) : view;
      return { timer: resetTimer(current.timer), endsAt: null, finished: null, announcement: "" };
    }
    case "choose": {
      const current = timeIsUp(view, action.now) ? finishRound(view) : view;
      const timer = chooseMode(current.timer, action.mode);
      return { timer, endsAt: null, finished: null, announcement: fresh(current.announcement, `${MODES[action.mode].label} selected, ${clock(timer.remaining)}.`) };
    }
  }
}

/** Tab title: the time left while running, a plain "time is up" after a round, else the site title. */
export function tabTitle(view: TimerView, siteTitle: string): string {
  const { timer, finished } = view;
  if (timer.active) return `${clock(timer.remaining)} ${MODES[timer.mode].label} · ${siteTitle}`;
  if (finished) return `Time is up: ${MODES[finished].label} done · ${siteTitle}`;
  return siteTitle;
}
