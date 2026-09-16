import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveAppearance } from "@/composables/useAppearance";
import { themePreferenceKey } from "@/modules/constants";

/**
 * index.html carries a blocking inline script that sets `.p-dark` before
 * the bundle loads, so a page never paints in the wrong appearance. It
 * encodes the same rule as `resolveAppearance()` in plain JS; this test
 * runs it against fakes and checks the two agree on every input.
 */
const html = readFileSync(join(import.meta.dirname, "..", "..", "..", "index.html"), "utf8");

function inlineHeadScript(): string {
  const head = html.slice(0, html.indexOf("</head>"));
  const match = head.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("index.html has no inline <script> in <head>");
  return match[1];
}

function runFirstPaint({ stored, osDark }: { stored: string | null; osDark: boolean }) {
  const classes = new Set<string>();
  const root = {
    classList: {
      toggle(token: string, force: boolean) {
        if (force) classes.add(token);
        else classes.delete(token);
      },
    },
    style: { colorScheme: "" },
  };
  const meta = { content: "" };
  const document = {
    documentElement: root,
    querySelector: (selector: string) => (selector === 'meta[name="theme-color"]' ? meta : null),
  };
  const localStorage = { getItem: (key: string) => (key === themePreferenceKey ? stored : null) };
  const matchMedia = (query: string) => ({
    matches: query === "(prefers-color-scheme: dark)" && osDark,
  });

  new Function("localStorage", "matchMedia", "document", inlineHeadScript())(
    localStorage,
    matchMedia,
    document,
  );
  return {
    dark: classes.has("p-dark"),
    colorScheme: root.style.colorScheme,
    themeColor: meta.content,
  };
}

describe("first-paint appearance script", () => {
  it.each([
    ["system", false],
    ["system", true],
    ["light", false],
    ["light", true],
    ["dark", false],
    ["dark", true],
  ] as const)(
    "agrees with resolveAppearance for %s preference, OS dark=%s",
    (preference, osDark) => {
      const expected = resolveAppearance(preference, osDark);
      const painted = runFirstPaint({
        stored: preference === "system" ? null : preference,
        osDark,
      });

      expect(painted.dark).toBe(expected === "dark");
      expect(painted.colorScheme).toBe(expected);
      expect(painted.themeColor).toBe(expected === "dark" ? "#18181b" : "#f1f5f9");
    },
  );

  it("treats an unknown stored value as System", () => {
    expect(runFirstPaint({ stored: "auto", osDark: true }).dark).toBe(true);
    expect(runFirstPaint({ stored: "auto", osDark: false }).dark).toBe(false);
  });

  it("ships a theme-color meta for the script and composable to update", () => {
    expect(html).toMatch(/<meta name="theme-color"/);
  });
});
