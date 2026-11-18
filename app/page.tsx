"use client";

import { useEffect, useReducer } from "react";
import { AppFoot, AppTop } from "@/components/app-shell";
import { SITE_TITLE, SOURCE_URL } from "@/lib/site";
import { LONG_BREAK_EVERY, MODES, clock, initialView, tabTitle, timerReducer, type Mode } from "@/lib/timer";

const MODE_ORDER = Object.keys(MODES) as Mode[];

export default function Home() {
  const [view, dispatch] = useReducer(timerReducer, undefined, initialView);
  const { mode, remaining, active, sessions } = view.timer;
  const duration = MODES[mode].duration;

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

  // The tab title is the end-of-round signal: time left while running, "Time is up" after a round.
  const title = tabTitle(view, SITE_TITLE);
  useEffect(() => {
    document.title = title;
  }, [title]);
  useEffect(() => () => { document.title = SITE_TITLE; }, []);

  // The real share for the bar and aria-valuenow; the words round down, so they never say 100% while time is left.
  const progress = ((duration - remaining) / duration) * 100;
  const percentText = Math.floor(progress);
  const marks = sessions % LONG_BREAK_EVERY;

  return (
    <div className="as">
      <a className="as-skip" href="#timer">Skip to timer</a>
      <AppTop name="Pomodoro" tagline="Focus and break timer" />

      <main id="timer" className="pt-body as-skip-target">
        <h1 className="as-sr">Pomodoro timer</h1>
        <div className="as-segmented pt-modes" role="group" aria-label="Timer mode">
          {MODE_ORDER.map((item) => (
            <button type="button" key={item} aria-pressed={mode === item} onClick={() => dispatch({ type: "choose", mode: item })}>
              {MODES[item].label}
            </button>
          ))}
        </div>

        <section className="pt-card" aria-label={`${MODES[mode].label} timer`}>
          <p className="pt-mode">
            <strong>{MODES[mode].label}</strong> · {duration / 60} min · {active ? "running" : remaining === duration ? "ready" : "paused"}
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
            <button type="button" className="as-button pt-start" onClick={() => dispatch({ type: "toggle", now: performance.now() })}>
              {active ? "Pause" : remaining === duration ? "Start" : "Resume"}
            </button>
            <button type="button" className="as-plain" onClick={() => dispatch({ type: "reset" })}>Reset</button>
          </div>
        </section>

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
