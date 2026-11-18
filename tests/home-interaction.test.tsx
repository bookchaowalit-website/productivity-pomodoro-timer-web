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
const seconds = (n: number) => act(() => { vi.advanceTimersByTime(n * 1000); });
const clockText = () => $('[role="timer"]').textContent;
const bar = () => $('[role="progressbar"]');
const status = () => $('[role="status"]').textContent;
const pressed = () => [...host.querySelectorAll('[aria-label="Timer mode"] button[aria-pressed="true"]')].map((b) => b.textContent);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
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
