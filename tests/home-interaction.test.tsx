// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { SITE_TITLE } from "@/lib/site";

// Mounted tests for the Pomodoro timer on the App shell, with a fake one-second interval.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const $ = <T extends Element = HTMLElement>(selector: string) => host.querySelector(selector) as T;
const button = (text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;
const press = (el: Element) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
// performance.now() is the timer's clock: a hand-moved reading, advanced together with the fake interval.
let perf = 0;
const seconds = (n: number) => act(() => { perf += n * 1000; vi.advanceTimersByTime(n * 1000); });
const jump = (ms: number) => { perf += ms; }; // time passes with no interval callbacks (throttled tab)
const clockText = () => $('[role="timer"]').textContent;
const bar = () => $('[role="progressbar"]');
const status = () => $('[role="status"]').textContent;
const pressed = () => [...host.querySelectorAll('[aria-label="Timer mode"] button[aria-pressed="true"]')].map((b) => b.textContent);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date"] });
  perf = 0;
  vi.spyOn(performance, "now").mockImplementation(() => perf);
  document.title = SITE_TITLE;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Home />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("modes", () => {
  it("starts on Focus and switching mode loads its duration, pauses and announces it", () => {
    expect(pressed()).toEqual(["Focus"]);
    expect(clockText()).toBe("25:00");
    press(button("Start"));
    seconds(3);
    press(button("Long break"));
    expect(pressed()).toEqual(["Long break"]);
    expect(clockText()).toBe("15:00");
    expect(button("Start")).toBeTruthy();
    expect(status()).toBe("Long break selected, 15:00. Focus round cleared at 24:57. Undo is available until you start the next round.");
    seconds(5);
    expect(clockText()).toBe("15:00");
  });

  it("re-selecting the running mode resets it and announces it again", () => {
    press(button("Start"));
    seconds(4);
    expect(status()).toBe("");
    press(button("Focus"));
    expect(clockText()).toBe("25:00");
    expect(status()).toBe("Focus selected, 25:00. Focus round cleared at 24:56. Undo is available until you start the next round.");
    press(button("Focus")); // nothing started now, so the plain line
    expect(status()).toBe("Focus selected, 25:00.");
    press(button("Focus")); // same message twice: the text still changes, so it is read again
    expect(status()).toBe("Focus selected, 25:00.\u00a0");
  });
});

describe("start, pause, reset", () => {
  it("counts down while running, holds when paused and resets the current mode", () => {
    press(button("Start"));
    seconds(2);
    expect(clockText()).toBe("24:58");
    expect(document.title).toBe(`24:58 Focus · ${SITE_TITLE}`);
    expect(status()).toBe(""); // the tick itself is never announced
    press(button("Pause"));
    expect(document.title).toBe(SITE_TITLE);
    seconds(10);
    expect(clockText()).toBe("24:58");
    expect(button("Resume")).toBeTruthy();
    press(button("Reset"));
    expect(clockText()).toBe("25:00");
    expect(button("Start")).toBeTruthy();
  });

  it("exposes the progress as a progressbar with a value text", () => {
    expect(bar().getAttribute("aria-valuemin")).toBe("0");
    expect(bar().getAttribute("aria-valuemax")).toBe("100");
    expect(bar().getAttribute("aria-valuenow")).toBe("0");
    press(button("Short break"));
    press(button("Start"));
    seconds(150);
    expect(bar().getAttribute("aria-valuenow")).toBe("50");
    expect(bar().getAttribute("aria-valuetext")).toBe("50% done, 02:30 left of 05:00");
    seconds(148); // 2 seconds left
    expect(Number(bar().getAttribute("aria-valuenow"))).toBeLessThan(100);
    expect(bar().getAttribute("aria-valuetext")).toBe("99% done, 00:02 left of 05:00");
    expect(bar().querySelector("span")!.style.width).not.toBe("100%");
  });
});

describe("a throttled background tab", () => {
  it("catches up from the wall clock when ticks are late or missing", () => {
    press(button("Start"));
    // The browser throttles the hidden tab: 10 minutes pass with no interval callbacks at all.
    jump(10 * 60_000);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(clockText()).toBe("15:00");
    expect(document.title).toBe(`15:00 Focus · ${SITE_TITLE}`);
    jump(15 * 60_000);
    seconds(1); // a single late tick still ends the round on time
    expect(document.title).toBe(`Time is up: Focus done · ${SITE_TITLE}`);
    expect(pressed()).toEqual(["Short break"]);
  });
});

describe("deadline timeout", () => {
  it("ends the round at the deadline even when the interval never fires", () => {
    act(() => root.unmount());
    // A throttled hidden tab: the display interval is starved, only the one-shot timeout runs.
    vi.spyOn(window, "setInterval").mockImplementation(() => 0 as unknown as ReturnType<typeof setInterval>);
    root = createRoot(host);
    act(() => root.render(<Home />));
    press(button("Start"));
    seconds(25 * 60 - 1);
    expect(document.title).toBe(`25:00 Focus · ${SITE_TITLE}`);
    seconds(1.02); // the deadline plus the timeout's 20 ms of slack
    expect(document.title).toBe(`Time is up: Focus done · ${SITE_TITLE}`);
    expect(pressed()).toEqual(["Short break"]);
  });

  it("drops the timeout when paused", () => {
    press(button("Start"));
    seconds(5);
    press(button("Pause"));
    seconds(25 * 60);
    expect(clockText()).toBe("24:55");
    expect(button("Resume")).toBeTruthy();
  });

  it("reports an exact percentage (87 s of a 5 min break is 29%)", () => {
    press(button("Short break"));
    press(button("Start"));
    seconds(87);
    expect(bar().getAttribute("aria-valuetext")).toBe("29% done, 03:33 left of 05:00");
  });
});

describe("clock changes and late pauses", () => {
  it("ignores the system clock being set back, and small forward corrections", () => {
    press(button("Start"));
    seconds(60);
    act(() => { vi.setSystemTime(Date.now() - 60 * 60_000); }); // clock set back one hour
    seconds(1);
    expect(clockText()).toBe("23:59");
    act(() => { vi.setSystemTime(Date.now() + 1500); }); // an NTP-sized step forward
    seconds(1);
    expect(clockText()).toBe("23:58");
    // A large forward jump looks exactly like sleep and counts as elapsed time (PRODUCT.md Known limits).
  });

  it("Pause after time ran out but before a tick ends and counts the round", () => {
    press(button("Start"));
    jump(25 * 60_000 + 500);
    press(button("Pause"));
    expect(pressed()).toEqual(["Short break"]);
    expect(clockText()).toBe("05:00");
    expect(host.textContent).toContain("1 focus block completed in this visit.");
    expect(document.title).toBe(`Time is up: Focus done · ${SITE_TITLE}`);
    expect(button("Start")).toBeTruthy();
  });
});

describe("late Reset or mode pick", () => {
  it("counts the focus block whose time ran out before the tick", () => {
    press(button("Start"));
    jump(25 * 60_000 + 200);
    press(button("Long break"));
    expect(pressed()).toEqual(["Long break"]);
    expect(host.textContent).toContain("1 focus block completed in this visit.");
  });

  it("Reset after the end counts the block too", () => {
    press(button("Start"));
    jump(25 * 60_000 + 200);
    press(button("Reset"));
    expect(host.textContent).toContain("1 focus block completed in this visit.");
    expect(clockText()).toBe("05:00");
  });
});

describe("end of a round", () => {
  it("moves to the break, marks the session, says time is up in the title and the live region", () => {
    press(button("Start"));
    seconds(25 * 60);
    expect(pressed()).toEqual(["Short break"]);
    expect(clockText()).toBe("05:00");
    expect(document.title).toBe(`Time is up: Focus done · ${SITE_TITLE}`);
    expect(status()).toBe("Focus finished. Short break is ready, 05:00. Press Start when you are.");
    expect(host.querySelectorAll('.pt-marks li[data-done]').length).toBe(1);
    expect(host.textContent).toContain("1 focus block completed in this visit.");
    seconds(60);
    expect(clockText()).toBe("05:00"); // holds until the person starts the break
    press(button("Start"));
    expect(document.title).toBe(`05:00 Short break · ${SITE_TITLE}`);
    expect(status()).toBe(""); // the old "press Start" message is gone once the break runs
  });

  it("restores the site title when the page goes away", () => {
    press(button("Start"));
    seconds(1);
    act(() => root.unmount());
    expect(document.title).toBe(SITE_TITLE);
    root = createRoot(host);
    act(() => root.render(<Home />));
  });
});

describe("review 2026-11-18", () => {
  const toast = () => host.querySelector(".as-toast");

  it("Reset is aria-disabled while the round has not started, and does nothing", () => {
    expect(button("Reset").getAttribute("aria-disabled")).toBe("true");
    press(button("Reset"));
    expect(toast()).toBeNull();
    press(button("Start"));
    seconds(3);
    expect(button("Reset").getAttribute("aria-disabled")).toBeNull();
  });

  it("Reset during a round offers Undo, which brings the round back paused", () => {
    press(button("Start"));
    seconds(623);
    press(button("Reset"));
    expect(clockText()).toBe("25:00");
    expect(toast()!.textContent).toContain("Focus cleared at 14:37");
    press(host.querySelector<HTMLButtonElement>(".as-toast button")!);
    expect(toast()).toBeNull();
    expect(clockText()).toBe("14:37");
    expect(button("Resume")).toBeTruthy();
    expect(status()).toContain("Focus restored, 14:37 left, paused.");
  });

  it("Reset announces that the round was cleared and Undo is available, once", () => {
    press(button("Start"));
    seconds(623);
    press(button("Reset"));
    expect(status()).toBe("Focus round cleared at 14:37. Undo is available until you start the next round.");
    seconds(2);
    expect(status()).toBe("Focus round cleared at 14:37. Undo is available until you start the next round."); // no per-tick updates
  });

  it("a mode pick mid-round offers Undo, which waits (no timeout) until the next Start", () => {
    press(button("Start"));
    seconds(10);
    press(button("Short break"));
    expect(toast()!.textContent).toContain("Focus cleared at 24:50");
    seconds(120); // a keyboard or screen-reader user still reaches Undo
    expect(toast()).not.toBeNull();
    press(button("Start"));
    expect(toast()).toBeNull();
  });

  it("shows a visible done line after a round until the next press", () => {
    press(button("Start"));
    seconds(25 * 60);
    expect($(".pt-done").textContent).toBe("Focus done — Short break is ready");
    press(button("Start"));
    expect(host.querySelector(".pt-done")).toBeNull();
  });

  it("keeps all four marks filled during the long break after the fourth focus block", () => {
    for (let round = 0; round < 4; round += 1) {
      if (!pressed().includes("Focus")) press(button("Focus"));
      press(button("Start"));
      seconds(25 * 60);
    }
    expect(pressed()).toEqual(["Long break"]);
    expect([...host.querySelectorAll(".pt-marks li")].map((li) => li.textContent)).toEqual(["Done", "Done", "Done", "Done"]);
    expect($(".pt-sessions p").textContent).toContain("4 of 4 focus blocks");
  });
});

describe("deferred review 2026-11-19", () => {
  const toast = () => host.querySelector(".as-toast");
  const undoButton = () => host.querySelector<HTMLButtonElement>(".as-toast button")!;

  it("a Pause click that lands after the visibility tick ended the round does not start the break", () => {
    press(button("Start"));
    const pause = button("Pause"); // the button the person sees and clicks
    jump(25 * 60_000 + 300);
    // Tick and click are processed in one batch, before React shows the new label.
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      pause.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(pressed()).toEqual(["Short break"]);
    expect(clockText()).toBe("05:00");
    expect(button("Start")).toBeTruthy();
    seconds(5);
    expect(clockText()).toBe("05:00"); // the break waits for Start
  });

  it("a Pause press that began before the round ended does not start the break on release", () => {
    press(button("Start"));
    const pause = button("Pause");
    act(() => { pause.dispatchEvent(new Event("pointerdown", { bubbles: true })); });
    // The round ends while the button is held: the tab catches up and React redraws Pause as Start.
    jump(25 * 60_000 + 300);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(pressed()).toEqual(["Short break"]);
    expect(button("Start")).toBeTruthy();
    // Release: the click (a pointer click, detail 1) lands on the button now labelled Start.
    act(() => { button("Start").dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 })); });
    seconds(5);
    expect(clockText()).toBe("05:00");
    expect(button("Start")).toBeTruthy();
    // A fresh press on Start still starts the break.
    act(() => { button("Start").dispatchEvent(new Event("pointerdown", { bubbles: true })); });
    press(button("Start"));
    seconds(5);
    expect(clockText()).toBe("04:55");
  });

  it("after catching up on sleep, the round-end timeout is set again for the real deadline", () => {
    press(button("Start"));
    seconds(15 * 60);
    const timeouts = vi.spyOn(window, "setTimeout");
    act(() => { vi.setSystemTime(Date.now() + 9 * 60_000); }); // slept 9 min; performance.now() stood still
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(clockText()).toBe("01:00");
    // A new one-shot for the remaining minute (+20 ms), not the old one still ~10 min away.
    const delays = timeouts.mock.calls.map((call) => call[1] as number);
    expect(delays.some((ms) => ms >= 60_000 && ms <= 60_100)).toBe(true);
    timeouts.mockRestore();
  });

  it("a held Enter is not a second press: its repeat keydown is prevented and does not toggle", () => {
    press(button("Start"));
    const repeat = new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true, cancelable: true });
    act(() => { button("Pause").dispatchEvent(repeat); });
    expect(repeat.defaultPrevented).toBe(true);
    expect(button("Pause")).toBeTruthy();
  });

  it("a pointer leaving the button does not cancel a held Space on Pause", () => {
    press(button("Start"));
    act(() => { button("Pause").dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true })); });
    jump(25 * 60_000 + 300);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    act(() => { button("Start").dispatchEvent(new MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body })); });
    act(() => { button("Start").dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 })); }); // Space released
    seconds(5);
    expect(clockText()).toBe("05:00");
  });

  it("a press dragged off the button leaves no intent behind", () => {
    press(button("Start"));
    act(() => { button("Pause").dispatchEvent(new Event("pointerdown", { bubbles: true })); });
    // React builds onPointerLeave from pointerout to an element outside the button.
    act(() => { button("Pause").dispatchEvent(new MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body })); });
    jump(25 * 60_000 + 300);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    act(() => { button("Start").dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    seconds(5);
    expect(clockText()).toBe("04:55");
  });

  it("a touch on Pause held while the round ends still pauses: touch leaves the button before its click", () => {
    press(button("Start"));
    act(() => { button("Pause").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" })); });
    jump(25 * 60_000 + 300);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    act(() => { button("Start").dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "touch", relatedTarget: document.body })); });
    act(() => { button("Start").dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 })); });
    seconds(5);
    expect(clockText()).toBe("05:00");
  });

  it("a press dragged off Pause and back on keeps its Pause intent", () => {
    press(button("Start"));
    act(() => { button("Pause").dispatchEvent(new Event("pointerdown", { bubbles: true })); });
    act(() => { button("Pause").dispatchEvent(new MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body })); });
    jump(25 * 60_000 + 300);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    act(() => { button("Start").dispatchEvent(new MouseEvent("pointerover", { bubbles: true, buttons: 1, relatedTarget: document.body })); });
    act(() => { button("Start").dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 })); });
    seconds(5);
    expect(clockText()).toBe("05:00");
  });

  it("holding Space on Pause while the round ends does not start the break on release", () => {
    press(button("Start"));
    const key = (repeat: boolean) => act(() => { button(repeat ? "Start" : "Pause").dispatchEvent(new KeyboardEvent("keydown", { key: " ", repeat, bubbles: true })); });
    key(false);
    jump(25 * 60_000 + 300);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    key(true); // auto-repeat after the button became Start
    act(() => { button("Start").dispatchEvent(new MouseEvent("click", { bubbles: true })); }); // Space released
    seconds(5);
    expect(clockText()).toBe("05:00");
  });

  it("a cancelled press leaves no intent: a click-only Start (assistive tech) still starts", () => {
    press(button("Start"));
    act(() => { button("Pause").dispatchEvent(new Event("pointerdown", { bubbles: true })); });
    act(() => { button("Pause").dispatchEvent(new Event("pointercancel", { bubbles: true })); });
    jump(25 * 60_000 + 300);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    act(() => { button("Start").dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    seconds(5);
    expect(clockText()).toBe("04:55");
  });

  it("picking a mode that has not started keeps the earlier Undo", () => {
    press(button("Start"));
    seconds(10);
    press(button("Short break")); // clears the running focus block: Undo appears
    seconds(3);
    press(button("Focus")); // the short break never started: nothing new is lost
    seconds(30);
    expect(toast()!.textContent).toContain("Focus cleared at 24:50");
  });

  it("a round whose deadline passed while the device slept ends on wake, even if performance.now() stood still", () => {
    press(button("Start"));
    seconds(60);
    // Sleep: the wall clock moves 30 min, performance.now() (perf) does not, no timers fire.
    act(() => { vi.setSystemTime(Date.now() + 30 * 60_000); });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(pressed()).toEqual(["Short break"]);
    expect($(".pt-done").textContent).toBe("Focus done — Short break is ready");
    expect(document.title).toContain("Time is up");
  });

  it("returns focus to the timer button after Undo or Escape from inside the toast", () => {
    press(button("Start"));
    seconds(5);
    press(button("Reset"));
    act(() => { undoButton().focus(); });
    press(undoButton());
    expect(document.activeElement).toBe(button("Resume"));
    press(button("Reset"));
    act(() => { undoButton().focus(); });
    act(() => { undoButton().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(toast()).toBeNull();
    expect(document.activeElement).toBe(button("Start"));
  });

  it("a long break picked by hand after the cycle's break shows 0 of 4, not 4 of 4", () => {
    for (let round = 0; round < 4; round += 1) {
      if (!pressed().includes("Focus")) press(button("Focus"));
      press(button("Start"));
      seconds(25 * 60);
    }
    press(button("Start"));
    seconds(15 * 60); // the long break ends
    expect($(".pt-sessions p").textContent).toContain("0 of 4 focus blocks");
    press(button("Long break"));
    expect($(".pt-sessions p").textContent).toContain("0 of 4 focus blocks");
  });

  it("places the Undo toast right after the timer card, so it can join the flow on short screens", () => {
    press(button("Start"));
    seconds(5);
    press(button("Reset"));
    expect(toast()!.previousElementSibling!.classList.contains("pt-card")).toBe(true);
  });
});
