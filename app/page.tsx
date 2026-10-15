"use client";

import { useEffect, useState } from "react";
import { MODES, initialTimer, chooseMode as switchMode, resetTimer, tickTimer, clock, type Mode } from "@/lib/timer";

export default function Home() {
  const [timer, setTimer] = useState(initialTimer);
  const { mode, remaining, active, sessions } = timer;

  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => setTimer(tickTimer), 1000);
    return () => window.clearInterval(interval);
  }, [active]);

  const chooseMode = (nextMode: Mode) => setTimer(current => switchMode(current, nextMode));
  const reset = () => setTimer(resetTimer);

  const progress = 1 - remaining / MODES[mode].duration;

  return (
    <main className="focus-shell">
      <div className="focus-frame">
        <header className="focus-topbar">
          <a href="https://bookchaowalit.com" className="focus-mark" aria-label="Bookchaowalit home"><span>FOCUS</span> / FOLD</a>
          <span>ONE CLOCK / NO SYNC</span>
          <span>{String(sessions).padStart(2, "0")} COMPLETED</span>
        </header>

        <section className="focus-intro">
          <div>
            <h1>Make room for<br /><em>one thing.</em></h1>
            <p>A quiet interval clock for the work in front of you. Choose a fold, start the room, and come back when the mark is complete.</p>
          </div>
          <div className="fold-mark" aria-hidden="true"><span>LOCAL</span><b>{String(sessions).padStart(2, "0")}</b><span>NO ALERTS</span></div>
        </section>

        <section className="fold-desk" aria-label="Pomodoro timer">
          <div className="fold-sheet">
            <div className="sheet-head"><span>ACTIVE FOLD / {MODES[mode].short}</span><span>{active ? "RUNNING" : "HELD"}</span></div>
            <div className="timer-copy">
              <p className="field-label">{MODES[mode].label}</p>
              <div className="timer-value" aria-live="polite">{clock(remaining)}</div>
              <p className="timer-note">{MODES[mode].note} / {active ? "stay with it" : "ready when you are"}</p>
            </div>
            <div className="crease-track" aria-label={`${Math.round(progress * 100)} percent complete`}>
              <span style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="timer-actions">
              <button type="button" className={active ? "primary pause" : "primary"} onClick={() => setTimer(current => ({ ...current, active: !current.active }))}>{active ? "Pause clock" : "Start clock"}</button>
              <button type="button" className="secondary" onClick={reset}>Reset fold</button>
            </div>
            <p className="boundary-note"><b>LOCAL TIMER</b> / This page does not send alerts, store history, or sync a session.</p>
          </div>

          <aside className="mode-rail">
            <div className="sheet-head"><span>FOLD TYPES</span><span>SELECT ONE</span></div>
            <div className="mode-list">
              {(Object.keys(MODES) as Mode[]).map((item) => (
                <button type="button" key={item} className={mode === item ? "mode-row selected" : "mode-row"} onClick={() => chooseMode(item)} aria-pressed={mode === item}>
                  <span className="mode-index">{item === "work" ? "A" : item === "shortBreak" ? "B" : "C"}</span>
                  <span><strong>{MODES[item].label}</strong><small>{MODES[item].duration / 60} MIN / {MODES[item].note}</small></span>
                  <span className="mode-state">{mode === item ? "OPEN" : "FOLD"}</span>
                </button>
              ))}
            </div>
            <div className="session-log"><span className="field-label">SESSION MARKS</span><div>{[0, 1, 2, 3].map((mark) => <span className={mark < sessions % 4 ? "mark filled" : "mark"} key={mark}>{mark < sessions % 4 ? "DONE" : "NEXT"}</span>)}</div><p>Every fourth focus fold opens a longer reset.</p></div>
          </aside>
        </section>

        <footer className="focus-footer"><span>BOOK / DEV TOOLS</span><span>FOCUS · PAUSE · RETURN</span></footer>
      </div>
    </main>
  );
}
