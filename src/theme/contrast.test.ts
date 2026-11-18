/**
 * WCAG AA contrast check for every theme's text/background pairs
 * (docs/DESIGN.md §11.2). Reads the tokens straight from globals.css so the
 * check can't drift from what ships.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");

function themeTokens(theme: string): Record<string, string> {
  const block = css.match(new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`));
  if (!block) throw new Error(`theme "${theme}" not found in globals.css`);
  return Object.fromEntries(
    [...block[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]),
  );
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** [text token, background token] pairs that appear in the UI. */
const TEXT_PAIRS: [string, string][] = [
  ["ink", "canvas"],
  ["ink", "surface"],
  ["ink", "surface-2"],
  ["ink-muted", "canvas"],
  ["ink-muted", "surface"],
  ["ink-muted", "surface-2"],
  ["accent", "surface"],
  ["accent", "accent-soft"],
  ["on-accent", "accent"],
  ["xp", "surface"],
  ["xp", "xp-soft"],
  ["warn", "warn-soft"],
];

const THEMES = ["minimal"];

describe.each(THEMES)("theme %s", (theme) => {
  const tokens = themeTokens(theme);

  it.each(TEXT_PAIRS)("%s on %s meets WCAG AA (4.5:1)", (fg, bg) => {
    expect(tokens[fg], `missing --${fg}`).toBeDefined();
    expect(tokens[bg], `missing --${bg}`).toBeDefined();
    expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5);
  });
});
