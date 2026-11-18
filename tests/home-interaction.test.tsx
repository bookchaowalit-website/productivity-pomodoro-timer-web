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
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
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
    expect(status()).toBe("Long break selected, 15:00.");
    seconds(5);
    expect(clockText()).toBe("15:00");
  });

  it("re-selecting the running mode resets it and announces it again", () => {
    press(button("Start"));
    seconds(4);
    expect(status()).toBe("");
    press(button("Focus"));
    expect(clockText()).toBe("25:00");
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

describe("clock changes and late pauses", () => {
  it("ignores the system clock being set back or forward", () => {
    press(button("Start"));
    seconds(60);
    act(() => { vi.setSystemTime(Date.now() - 60 * 60_000); }); // clock set back one hour
    seconds(1);
    expect(clockText()).toBe("23:59");
    act(() => { vi.setSystemTime(Date.now() + 5 * 60 * 60_000); }); // and forward five hours
    seconds(1);
    expect(clockText()).toBe("23:58");
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
