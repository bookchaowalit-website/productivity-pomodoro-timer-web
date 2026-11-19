"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { AppFoot, AppTop } from "@/components/app-shell";
import { SITE_TITLE, SOURCE_URL } from "@/lib/site";
import { LONG_BREAK_EVERY, MODES, clock, cycleMarks, finishedLine, initialView, interruptedRound, tabTitle, timerReducer, type Mode, type TimerState } from "@/lib/timer";

const MODE_ORDER = Object.keys(MODES) as Mode[];

export default function Home() {
  const [view, dispatch] = useReducer(timerReducer, undefined, initialView);
  const { mode, remaining, active, sessions } = view.timer;
  const duration = MODES[mode].duration;
  // A Reset or mode pick that threw away a started round, kept for a few seconds so Undo can bring it back.
  const [undoRound, setUndoRound] = useState<TimerState | null>(null);
  const [toastHeld, setToastHeld] = useState({ hover: false, focus: false });
  const held = toastHeld.hover || toastHeld.focus;
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!undoRound || held) return;
    const timer = window.setTimeout(() => setUndoRound(null), 6000);
    return () => window.clearTimeout(timer);
  }, [undoRound, held]);

  // Reset and mode picks stay one tap, but a started round they clear can be undone.
  function clearing(action: { type: "reset"; now: number } | { type: "choose"; mode: Mode; now: number }) {
    const { now } = action;
    const lost = interruptedRound(view, now);
    dispatch(action);
    // Picking a mode that has not started loses nothing, so an earlier Undo stays with its own deadline.
    if (!lost) return;
    setUndoRound(lost);
    setToastHeld({ hover: false, focus: false });
  }
  // Closing the toast while focus is inside it sends focus to the timer button, not to <body>.
  function closeToast(focusInside: boolean) {
    setUndoRound(null);
    setToastHeld({ hover: false, focus: false });
    if (focusInside) startRef.current?.focus();
  }
  function undo(focusInside: boolean) {
    if (!undoRound) return;
    dispatch({ type: "restore", timer: undoRound });
    closeToast(focusInside);
  }

  useEffect(() => {
    if (!active) return;
    // Ticks only re-read the monotonic clock; a tab coming back into view catches up at once.
    const tick = () => dispatch({ type: "tick", now: performance.now() });
    const interval = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active]);

  // A one-shot timeout at the deadline ends the round even when a hidden tab throttles the
  // interval above to about once a minute, so the "Time is up" title is not left waiting.
  const { endsAt } = view;
  useEffect(() => {
    if (endsAt === null) return;
    const timeout = window.setTimeout(
      () => dispatch({ type: "tick", now: performance.now() }),
      Math.max(0, endsAt - performance.now()) + 20,
    );
    return () => window.clearTimeout(timeout);
  }, [endsAt]);

  // The tab title is the end-of-round signal: time left while running, "Time is up" after a round.
  const title = tabTitle(view, SITE_TITLE);
  useEffect(() => {
    document.title = title;
  }, [title]);
  useEffect(() => () => { document.title = SITE_TITLE; }, []);

  // The real share for the bar and aria-valuenow; the words round down, so they never say 100% while time is left.
  const progress = ((duration - remaining) * 100) / duration; // multiply first: 87/300 s is exactly 29
  const percentText = Math.floor(progress);
  const marks = cycleMarks(view.timer);
  const done = finishedLine(view);
  const ready = !active && remaining === duration;

  return (
    <div className="as pt-app">
      <a className="as-skip" href="#timer">Skip to timer</a>
      <AppTop name="Pomodoro" tagline="Focus and break timer" />

      <main id="timer" className="pt-body as-skip-target">
        <h1 className="as-sr">Pomodoro timer</h1>
        <div className="as-segmented pt-modes" role="group" aria-label="Timer mode">
          {MODE_ORDER.map((item) => (
            <button type="button" key={item} aria-pressed={mode === item} onClick={() => clearing({ type: "choose", mode: item, now: performance.now() })}>
              {MODES[item].label}
            </button>
          ))}
        </div>

        <section className="pt-card" aria-label={`${MODES[mode].label} timer`}>
          {done ? <p className="pt-done">{done}</p> : null}
          <p className="pt-mode">
            <strong>{MODES[mode].label}</strong> · {duration / 60} min · {active ? "running" : ready ? "ready" : "paused"}
          </p>
          <p className="pt-clock" role="timer">{clock(remaining)}</p>
          <div
            className="pt-progress"
            role="progressbar"
            aria-label={`${MODES[mode].label} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-valuetext={`${percentText}% done, ${clock(remaining)} left of ${clock(duration)}`}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="pt-actions">
            {/* The action follows the label on screen: a Pause that lands just after a tick ended the round does nothing. */}
            <button type="button" ref={startRef} className="as-button pt-start" onClick={() => { setUndoRound(null); dispatch({ type: active ? "pause" : "start", now: performance.now() }); }}>
              {active ? "Pause" : ready ? "Start" : "Resume"}
            </button>
            {/* Nothing to reset while the round has not started: aria-disabled keeps focus on the button after a Reset. */}
            <button type="button" className="as-plain pt-reset" aria-disabled={ready ? "true" : undefined} onClick={() => { if (!ready) clearing({ type: "reset", now: performance.now() }); }}>Reset</button>
          </div>
        </section>

        {/* Placed after the timer so that on short screens, where it sits in the page flow, it is next to Start and Reset. */}
        {undoRound ? (
          <div
            className="as-toast"
            role="group"
            aria-label="Undo"
            onMouseEnter={() => setToastHeld((h) => ({ ...h, hover: true }))}
            onMouseLeave={() => setToastHeld((h) => ({ ...h, hover: false }))}
            onFocus={() => setToastHeld((h) => ({ ...h, focus: true }))}
            onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setToastHeld((h) => ({ ...h, focus: false })); }}
            onKeyDown={(event) => { if (event.key === "Escape") closeToast(event.currentTarget.contains(document.activeElement)); }}
          >
            <span>{MODES[undoRound.mode].label} cleared at {clock(undoRound.remaining)}</span>
            <button type="button" className="as-plain" onClick={(event) => undo(event.currentTarget === document.activeElement)} aria-label={`Undo: bring back ${MODES[undoRound.mode].label} at ${clock(undoRound.remaining)}`}>Undo</button>
          </div>
        ) : null}

        <section className="pt-card pt-sessions" aria-labelledby="sessions-title">
          <h2 id="sessions-title">Session marks</h2>
          <ol className="pt-marks">
            {Array.from({ length: LONG_BREAK_EVERY }, (_, index) => (
              <li key={index} data-done={index < marks ? "true" : undefined}>
                <span className="pt-dot" aria-hidden="true" />
                <span>{index < marks ? "Done" : "Next"}</span>
              </li>
            ))}
          </ol>
          <p>
            {marks} of {LONG_BREAK_EVERY} focus blocks in this cycle · every fourth one opens a long break.
            <br />
            <span className="pt-total">{sessions} focus {sessions === 1 ? "block" : "blocks"} completed in this visit.</span>
          </p>
        </section>

        <p className="as-sr" role="status" aria-live="polite">{view.announcement}</p>


        <p className="as-note">
          Runs in this tab only. No sound, no notifications and no saved history: the count resets when you reload. While
          the clock runs, the tab title shows the time left, and it says “Time is up” when a round ends.
        </p>
      </main>

      <AppFoot source={SOURCE_URL} />
    </div>
  );
}
