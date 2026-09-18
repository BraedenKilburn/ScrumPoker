import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Surfaces, shadows and edge highlights are valued per Appearance in
 * base.scss (`--surface-*`, `--shadow-color`, `--edge-highlight`). A
 * component that mixes the page background toward black/white, or drops
 * a literal black shadow / white highlight, bakes in a dark assumption
 * and inverts badly on a light page — so no stylesheet outside base.scss
 * may do it.
 */
const src = join(import.meta.dirname, "..", "..");
const tokenSheet = join(src, "assets", "base.scss");

const darkAssumptions: Array<[label: string, pattern: RegExp]> = [
  [
    "PrimeVue surface mixed toward black/white (use --surface-*)",
    /color-mix\(in srgb, var\(--p-(?:content-background|surface-\d+)\)[^)]*\b(?:black|white)\b/,
  ],
  ["literal black (use --shadow-color)", /rgba?\(\s*0\s*,?\s*0\s*,?\s*0\b/],
  ["literal white (use --edge-highlight)", /rgba?\(\s*255\s*,?\s*255\s*,?\s*255\b/],
];

function stylesheets(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : stylesheets(path);
    return /\.(vue|scss|css)$/.test(entry.name) && path !== tokenSheet ? [path] : [];
  });
}

describe("appearance surface tokens", () => {
  it("component and view styles reach surfaces, shadows and highlights only through the tokens", () => {
    const offenders = stylesheets(src).flatMap((path) => {
      const text = readFileSync(path, "utf8");
      return darkAssumptions
        .filter(([, pattern]) => pattern.test(text))
        .map(([label]) => `${relative(src, path)}: ${label}`);
    });

    expect(offenders).toEqual([]);
  });
});
