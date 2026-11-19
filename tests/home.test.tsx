import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";
import { SITE_URL } from "@/lib/site";

describe("home page (server render)", () => {
  const html = renderToString(<Home />);

  it("renders the timer on the App shell, mode control before the clock", () => {
    expect(html).toContain('class="as pt-app"');
    expect(html.indexOf('aria-label="Timer mode"')).toBeLessThan(html.indexOf('role="timer"'));
    expect(html).toContain(">25:00<");
    expect(html).toContain('href="https://bookchaowalit.com/"');
    expect(html).toMatch(/<main id="timer" class="[^"]*as-skip-target/);
    expect(readFileSync("app/app-shell.css", "utf8")).toMatch(/\.as-skip-target \{ scroll-margin-top: 64px; \}/);
    expect(readFileSync("scripts/deploy-smoke.sh", "utf8")).toContain(`HOME_MARKER='role="timer"'`);
    expect(readFileSync("app/app-shell.css", "utf8")).toMatch(/aria-pressed="true"\] \{[^}]*inset 0 -3px 0 var\(--as-accent\)/);
    expect(readFileSync("app/app-shell.css", "utf8")).toMatch(/@media \(forced-colors: active\) \{\s*\.as-segmented button\[aria-pressed="true"\] \{ border-bottom: 3px solid Highlight;/);
    expect(readFileSync("app/layout.tsx", "utf8")).toContain('Geist({ variable: "--font-geist-sans"');
    expect(html).not.toMatch(/FOCUS \/ FOLD|NO ALERTS|crease/i);
  });

  it("keeps the progress bar visible in forced colors", () => {
    const css = readFileSync("app/globals.css", "utf8");
    const block = css.slice(css.indexOf("@media (forced-colors: active)"));
    expect(block).toMatch(/\.pt-progress \{[^}]*border: 1px solid CanvasText/);
    expect(block).toMatch(/\.pt-progress span \{[^}]*forced-color-adjust: none;[^}]*background: Highlight/);
  });

  it("keeps the forced-colors focus ring distinct from the selected-mode marker", () => {
    const css = readFileSync("app/app-shell.css", "utf8");
    const block = css.slice(css.indexOf("@media (forced-colors: active)"));
    const rule = (selector: string) => block.match(new RegExp(`${selector.replace(/[[\]().*+?^$|]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";
    const selected = rule('.as-segmented button[aria-pressed="true"]');
    const focus = rule(".as-segmented button:focus-visible");
    // The selection must not set an outline, or it overrides (and looks like) the focus ring.
    expect(selected).toContain("border-bottom: 3px solid Highlight");
    expect(selected).not.toMatch(/outline/);
    expect(focus).toMatch(/outline: 3px solid CanvasText/);
    expect(focus).toMatch(/outline-offset: 2px/);
  });

  it("sizes the Undo toast to its text so phones show the mode and time left", () => {
    // left: 50% alone caps an auto-width fixed box at half the screen before translateX(-50%) runs.
    const css = readFileSync("app/app-shell.css", "utf8");
    const toast = css.match(/\.as-toast \{([^}]*)\}/)?.[1] ?? "";
    expect(toast).toMatch(/width: max-content/);
    expect(toast).toMatch(/max-width: calc\(100vw - 32px\)/);
  });

  it("lets the Undo text wrap instead of hiding the time left behind an ellipsis", () => {
    const css = readFileSync("app/app-shell.css", "utf8");
    const span = css.match(/\.as-toast span \{([^}]*)\}/)?.[1] ?? "";
    expect(span).not.toMatch(/nowrap|ellipsis/);
    expect(span).toMatch(/overflow-wrap: anywhere/);
    const toast = css.match(/\.as-toast \{([^}]*)\}/)?.[1] ?? "";
    expect(toast).toMatch(/border-radius: 22px/); // a pill radius would cut a two-line toast's corners
  });

  it("never live-announces the ticking clock", () => {
    expect(html).not.toMatch(/role="timer"[^>]*aria-live="(polite|assertive)"/);
    expect(html).toMatch(/role="status" aria-live="polite"/);
  });
});

describe("site metadata", () => {
  it("uses the app's own subdomain", () => {
    // app/layout.tsx uses next/font, which only loads under the Next compiler, so read its source.
    expect(SITE_URL).toBe("https://pomodoro-timer.bookchaowalit.com");
    const layout = readFileSync("app/layout.tsx", "utf8");
    expect(layout).toContain("metadataBase: new URL(SITE_URL)");
    expect(layout).toContain('alternates: { canonical: "/" }');
    expect(readFileSync("public/robots.txt", "utf8")).toContain("Sitemap: https://pomodoro-timer.bookchaowalit.com/sitemap.xml");
    expect(readFileSync("public/sitemap.xml", "utf8")).not.toMatch(/vercel\.app|more-projects/);
  });
});
