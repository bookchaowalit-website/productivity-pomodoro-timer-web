export type Mode = "work" | "shortBreak" | "longBreak";

export const MODES: Record<Mode, { label: string; short: string; duration: number; note: string }> = {
  work: { label: "Focus", short: "WORK", duration: 25 * 60, note: "one clear block" },
  shortBreak: { label: "Short break", short: "PAUSE", duration: 5 * 60, note: "step away" },
  longBreak: { label: "Long break", short: "RESET", duration: 15 * 60, note: "let the day widen" },
};

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
  const mode = state.mode === "work" ? (sessions % 4 === 0 ? "longBreak" : "shortBreak") : "work";
  return { mode, remaining: MODES[mode].duration, active: false, sessions };
}
