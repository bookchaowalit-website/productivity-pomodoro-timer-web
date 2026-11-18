import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";
import { SITE_URL } from "@/lib/site";

describe("home page (server render)", () => {
  const html = renderToString(<Home />);

  it("renders the timer on the App shell, mode control before the clock", () => {
    expect(html).toContain('class="as"');
    expect(html.indexOf('aria-label="Timer mode"')).toBeLessThan(html.indexOf('role="timer"'));
    expect(html).toContain(">25:00<");
    expect(html).toContain('href="https://bookchaowalit.com/"');
    expect(html).toMatch(/<main id="timer" class="[^"]*as-skip-target/);
    expect(readFileSync("app/app-shell.css", "utf8")).toMatch(/\.as-skip-target \{ scroll-margin-top: 64px; \}/);
    expect(readFileSync("app/layout.tsx", "utf8")).toContain('Geist({ variable: "--font-geist-sans"');
    expect(html).not.toMatch(/FOCUS \/ FOLD|NO ALERTS|crease/i);
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
