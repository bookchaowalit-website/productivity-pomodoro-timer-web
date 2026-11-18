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
 * `now` is Date.now() in ms. While running, the time left is derived from `endsAt` (the round's end
 * on the wall clock), not from counting interval callbacks: a background tab throttles setInterval,
 * so counting would lag and "Time is up" could come minutes late.
 */
export type TimerAction = { type: "tick"; now: number } | { type: "toggle"; now: number } | { type: "reset" } | { type: "choose"; mode: Mode };

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

export function timerReducer(view: TimerView, action: TimerAction): TimerView {
  switch (action.type) {
    case "tick": {
      if (!view.timer.active || view.endsAt === null) return view;
      const left = secondsLeft(view.endsAt, action.now);
      if (left === view.timer.remaining) return view;
      if (left > 0) return { ...view, timer: { ...view.timer, remaining: left } };
      // The round is over (however late this tick came): the last-second transition ends it.
      const timer = tickTimer({ ...view.timer, remaining: 1 });
      const ended = view.timer.mode;
      return {
        timer,
        endsAt: null,
        finished: ended,
        announcement: fresh(view.announcement, `${MODES[ended].label} finished. ${MODES[timer.mode].label} is ready, ${clock(timer.remaining)}. Press Start when you are.`),
      };
    }
    // Start, Pause and Reset are not announced; they clear an old "press Start" message.
    case "toggle": {
      if (view.timer.active) {
        // Pause keeps the time left on the wall clock.
        const remaining = view.endsAt === null ? view.timer.remaining : Math.max(1, secondsLeft(view.endsAt, action.now));
        return { timer: { ...view.timer, active: false, remaining }, endsAt: null, finished: null, announcement: "" };
      }
      return { timer: { ...view.timer, active: true }, endsAt: action.now + view.timer.remaining * 1000, finished: null, announcement: "" };
    }
    case "reset":
      return { timer: resetTimer(view.timer), endsAt: null, finished: null, announcement: "" };
    case "choose": {
      const timer = chooseMode(view.timer, action.mode);
      return { timer, endsAt: null, finished: null, announcement: fresh(view.announcement, `${MODES[action.mode].label} selected, ${clock(timer.remaining)}.`) };
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
