---
name: Pomodoro Timer (App shell)
description: A quiet local focus and break timer on the shared App shell.
---

# Design System: Pomodoro Timer

## Overview

Since 2026-11-18 the timer uses the shared App shell (see `APP-SHELL.md`): the calm, Apple-like look shared with
the reminders, habits and goals apps. The old "Focus Fold" paper, vermilion and stamp look is gone; the
2026-11-11 UX review found its contrast, tiny mono labels and phone layout below the floor.

## Colors

All colours are `--as-*` tokens on `:root` in `app/app-shell.css`, redefined for dark mode under
`prefers-color-scheme: dark`. The page styles in `app/globals.css` (`pt-*`) use only those tokens.

- Text `--as-fg` on `--as-bg` / `--as-surface`; secondary text `--as-muted` (4.7:1 on the page, 5.1:1 on cards).
- The one filled button (Start / Pause / Resume) is `--as-button` with white text (4.7:1).
- The progress fill and done session marks use `--as-accent` (4.6:1 against the track in both themes).

## Typography

Inter, loaded as a font file through `next/font` and set on `<html>`. The clock uses tabular numerals so the digits do
not jump. No text is smaller than 12px.

## Layout

One centred column (max 640px): top bar → mode segmented control → timer card (mode line, clock, progress, Start and
Reset) → session marks → the local-only note → footer. The mode control sits above the clock, so a phone sees mode,
clock and Start on the first screen.

## Components

- **Mode control:** `as-segmented` with Focus, Short break and Long break (`aria-pressed`).
- **Timer card:** the clock (`role="timer"`, not live), a `role="progressbar"` with value text, Start/Pause/Resume and
  Reset.
- **Session marks:** four slots with a ring or filled dot and the words Done / Next (never colour alone).
- **Status:** a visually hidden polite live region announces mode changes and round ends only, never each tick.
- **Footer:** links back to https://bookchaowalit.com/, the source, privacy and status.

## Do's and Don'ts

- Do keep the current mode and the next action obvious.
- Do keep the end-of-round signal to the tab title ("Time is up") and the status region.
- Don't add sound, notifications, cloud history, analytics or productivity scores.
- Don't announce the ticking clock to screen readers.
