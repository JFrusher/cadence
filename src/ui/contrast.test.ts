import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Every text colour the interface actually uses, against the ground it sits
 * on, must clear WCAG AA. Read from the token file itself, so changing a token
 * without checking it fails here rather than in front of a user.
 */

function tokens(): Record<string, string> {
  const css = readFileSync("src/index.css", "utf8");
  const found: Record<string, string> = {};
  for (const match of css.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-f]{3,8})\s*;/gi)) {
    found[match[1] as string] = match[2] as string;
  }
  return found;
}

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((value >> 16) & 255) +
    0.7152 * channel((value >> 8) & 255) +
    0.0722 * channel(value & 255)
  );
}

export function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** [text token, background token] — every pairing the interface puts on screen. */
const PAIRS: [string, string][] = [
  ["--grey-9", "--grey-0"],
  ["--grey-9", "--grey-1"],
  ["--grey-9", "--grey-2"],
  ["--grey-6", "--grey-0"],
  ["--grey-6", "--grey-1"],
  ["--grey-6", "--grey-2"],
  ["--accent", "--grey-0"],
  ["--accent", "--accent-soft"],
  ["--grey-0", "--accent"],
  ["--danger", "--grey-0"],
  ["--danger", "--danger-soft"],
  ["--warn", "--grey-0"],
  ["--warn", "--warn-soft"],
];

describe("token contrast", () => {
  const palette = tokens();

  it("has read the tokens", () => {
    expect(Object.keys(palette).length).toBeGreaterThan(15);
  });

  for (const [foreground, background] of PAIRS) {
    it(`${foreground} on ${background} clears AA`, () => {
      const fg = palette[foreground];
      const bg = palette[background];
      expect(fg, `${foreground} is not defined`).toBeTypeOf("string");
      expect(bg, `${background} is not defined`).toBeTypeOf("string");
      const ratio = contrast(fg as string, bg as string);
      expect(Number(ratio.toFixed(2))).toBeGreaterThanOrEqual(4.5);
    });
  }
});
