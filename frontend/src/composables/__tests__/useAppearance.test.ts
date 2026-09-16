import { afterEach, describe, expect, it } from "vitest";
import {
  THEME_COLOR,
  bootAppearance,
  resolveAppearance,
  useAppearance,
} from "@/composables/useAppearance";
import { themePreferenceKey } from "@/modules/constants";

describe("resolveAppearance", () => {
  it.each([
    ["system", false, "light"],
    ["system", true, "dark"],
    ["light", false, "light"],
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["dark", true, "dark"],
  ] as const)(
    "%s preference with OS dark=%s renders %s",
    (preference, systemPrefersDark, expected) => {
      expect(resolveAppearance(preference, systemPrefersDark)).toBe(expected);
    },
  );
});

/** Browser seam fakes: storage, the OS media query, and the <html> root. */
class FakeMediaQueryList {
  private listeners = new Set<(event: { matches: boolean }) => void>();

  constructor(public matches: boolean) {}

  addEventListener(_type: "change", listener: (event: { matches: boolean }) => void) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "change", listener: (event: { matches: boolean }) => void) {
    this.listeners.delete(listener);
  }

  /** The OS flipped its appearance. */
  change(matches: boolean) {
    this.matches = matches;
    this.listeners.forEach((listener) => listener({ matches }));
  }
}

class FakeRoot {
  classes = new Set<string>();
  style = { colorScheme: "" };
  themeColor = { content: "" };

  classList = {
    toggle: (token: string, force: boolean) => {
      if (force) this.classes.add(token);
      else this.classes.delete(token);
      return force;
    },
  };

  querySelector(selector: string) {
    if (selector !== 'meta[name="theme-color"]') return null;
    return {
      setAttribute: (name: string, value: string) => {
        if (name === "content") this.themeColor.content = value;
      },
    };
  }
}

function fakeBrowser({ stored, osDark }: { stored?: string; osDark: boolean }) {
  const root = new FakeRoot();
  const query = new FakeMediaQueryList(osDark);
  const storage = {
    getItem: (key: string) => (key === themePreferenceKey ? (stored ?? null) : null),
  };
  return { root, query, storage, matchMedia: () => query };
}

describe("appearance", () => {
  let dispose: (() => void) | undefined;
  afterEach(() => dispose?.());

  it("on a light OS with nothing stored, applies the light appearance to the root", () => {
    const browser = fakeBrowser({ osDark: false });
    dispose = bootAppearance(browser);

    expect(browser.root.classes.has("p-dark")).toBe(false);
    expect(browser.root.style.colorScheme).toBe("light");
    expect(browser.root.themeColor.content).toBe(THEME_COLOR.light);
    expect(useAppearance().appearance.value).toBe("light");
  });

  it("on a dark OS with nothing stored, applies the dark appearance to the root", () => {
    const browser = fakeBrowser({ osDark: true });
    dispose = bootAppearance(browser);

    expect(browser.root.classes.has("p-dark")).toBe(true);
    expect(browser.root.style.colorScheme).toBe("dark");
    expect(browser.root.themeColor.content).toBe(THEME_COLOR.dark);
    expect(useAppearance().appearance.value).toBe("dark");
  });

  it.each([
    ["system", false, "light"],
    ["system", true, "dark"],
    ["light", false, "light"],
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["dark", true, "dark"],
  ] as const)("a stored %s preference with OS dark=%s renders %s", (stored, osDark, expected) => {
    const browser = fakeBrowser({ stored, osDark });
    dispose = bootAppearance(browser);

    expect(browser.root.classes.has("p-dark")).toBe(expected === "dark");
    expect(useAppearance().themePreference.value).toBe(stored);
    expect(useAppearance().appearance.value).toBe(expected);
  });

  it.each(["", "DARK", "auto", "true", '{"mode":"dark"}'])(
    "an unknown or corrupt stored value %j resolves as System",
    (stored) => {
      const browser = fakeBrowser({ stored, osDark: true });
      dispose = bootAppearance(browser);

      expect(useAppearance().themePreference.value).toBe("system");
      expect(browser.root.classes.has("p-dark")).toBe(true);
    },
  );

  it("reads storage that throws as System rather than failing to paint", () => {
    const browser = fakeBrowser({ osDark: true });
    browser.storage.getItem = () => {
      throw new Error("SecurityError");
    };
    dispose = bootAppearance(browser);

    expect(useAppearance().themePreference.value).toBe("system");
    expect(browser.root.classes.has("p-dark")).toBe(true);
  });

  it("follows the OS flipping while the tab is open, in both directions", () => {
    const browser = fakeBrowser({ osDark: false });
    dispose = bootAppearance(browser);

    browser.query.change(true);
    expect(browser.root.classes.has("p-dark")).toBe(true);
    expect(browser.root.style.colorScheme).toBe("dark");
    expect(browser.root.themeColor.content).toBe(THEME_COLOR.dark);
    expect(useAppearance().appearance.value).toBe("dark");

    browser.query.change(false);
    expect(browser.root.classes.has("p-dark")).toBe(false);
    expect(browser.root.style.colorScheme).toBe("light");
    expect(browser.root.themeColor.content).toBe(THEME_COLOR.light);
    expect(useAppearance().appearance.value).toBe("light");
  });

  it("ignores the OS flipping when a stored preference overrides it", () => {
    const browser = fakeBrowser({ stored: "light", osDark: false });
    dispose = bootAppearance(browser);

    browser.query.change(true);
    expect(browser.root.classes.has("p-dark")).toBe(false);
    expect(useAppearance().appearance.value).toBe("light");
  });

  it("stops following the OS once disposed", () => {
    const browser = fakeBrowser({ osDark: false });
    bootAppearance(browser)();

    browser.query.change(true);
    expect(browser.root.classes.has("p-dark")).toBe(false);
  });
});
