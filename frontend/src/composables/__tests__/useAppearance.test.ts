import { afterEach, describe, expect, it } from "vitest";
import {
  THEME_COLOR,
  bootAppearance,
  resolveAppearance,
  useAppearance,
  type StorageEventLike,
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
  /** The classes present when styles were last forced to recompute. */
  classesAtReflow: Set<string> | null = null;

  get offsetHeight() {
    this.classesAtReflow = new Set(this.classes);
    return 0;
  }

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

/** localStorage plus the cross-tab `storage` event a sibling tab would fire. */
class FakeStorage {
  private listeners = new Set<(event: StorageEventLike) => void>();
  data = new Map<string, string>();

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.data.set(key, value);
  }

  addEventListener(_type: "storage", listener: (event: StorageEventLike) => void) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "storage", listener: (event: StorageEventLike) => void) {
    this.listeners.delete(listener);
  }

  /** Another tab wrote to storage: it lands in the data and fires `storage` here. */
  writeFromOtherTab(key: string | null, newValue: string | null) {
    if (key === null) this.data.clear();
    else if (newValue === null) this.data.delete(key);
    else this.data.set(key, newValue);
    this.listeners.forEach((listener) => listener({ key, newValue }));
  }
}

function fakeBrowser({ stored, osDark }: { stored?: string; osDark: boolean }) {
  const root = new FakeRoot();
  const query = new FakeMediaQueryList(osDark);
  const storage = new FakeStorage();
  if (stored !== undefined) storage.data.set(themePreferenceKey, stored);
  return { root, query, storage, matchMedia: () => query, storageEvents: storage };
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

describe("setting the theme preference", () => {
  let dispose: (() => void) | undefined;
  afterEach(() => dispose?.());

  it("applies the chosen appearance at once and persists it under the preference key", () => {
    const browser = fakeBrowser({ osDark: false });
    dispose = bootAppearance(browser);
    const { themePreference, appearance, setThemePreference } = useAppearance();

    setThemePreference("dark");
    expect(themePreference.value).toBe("dark");
    expect(appearance.value).toBe("dark");
    expect(browser.root.classes.has("p-dark")).toBe(true);
    expect(browser.root.style.colorScheme).toBe("dark");
    expect(browser.root.themeColor.content).toBe(THEME_COLOR.dark);
    expect(browser.storage.getItem(themePreferenceKey)).toBe("dark");

    setThemePreference("light");
    expect(appearance.value).toBe("light");
    expect(browser.root.classes.has("p-dark")).toBe(false);
    expect(browser.storage.getItem(themePreferenceKey)).toBe("light");
  });

  it("a persisted choice is what the next boot reads", () => {
    const browser = fakeBrowser({ osDark: false });
    const disposeFirst = bootAppearance(browser);
    useAppearance().setThemePreference("dark");
    disposeFirst();

    dispose = bootAppearance(browser);
    expect(useAppearance().themePreference.value).toBe("dark");
    expect(browser.root.classes.has("p-dark")).toBe(true);
  });

  it("choosing Light or Dark overrides the OS, including later OS flips", () => {
    const browser = fakeBrowser({ osDark: true });
    dispose = bootAppearance(browser);
    useAppearance().setThemePreference("light");
    expect(browser.root.classes.has("p-dark")).toBe(false);

    browser.query.change(false);
    browser.query.change(true);
    expect(browser.root.classes.has("p-dark")).toBe(false);
    expect(useAppearance().appearance.value).toBe("light");
  });

  it("choosing System resumes following the OS, now and on later OS flips", () => {
    const browser = fakeBrowser({ stored: "light", osDark: true });
    dispose = bootAppearance(browser);
    expect(browser.root.classes.has("p-dark")).toBe(false);

    useAppearance().setThemePreference("system");
    expect(useAppearance().themePreference.value).toBe("system");
    expect(useAppearance().appearance.value).toBe("dark");
    expect(browser.root.classes.has("p-dark")).toBe(true);
    expect(browser.storage.getItem(themePreferenceKey)).toBe("system");

    browser.query.change(false);
    expect(browser.root.classes.has("p-dark")).toBe(false);
    browser.query.change(true);
    expect(browser.root.classes.has("p-dark")).toBe(true);
  });

  it("switches with transitions off: the new appearance is computed under the switching class, then it lifts", () => {
    const browser = fakeBrowser({ osDark: false });
    dispose = bootAppearance(browser);

    useAppearance().setThemePreference("dark");
    expect(browser.root.classesAtReflow).toEqual(new Set(["p-dark", "appearance-switching"]));
    expect(browser.root.classes.has("appearance-switching")).toBe(false);
    expect(browser.root.classes.has("p-dark")).toBe(true);
  });

  it("still applies the choice for this tab when storage refuses the write", () => {
    const browser = fakeBrowser({ osDark: false });
    browser.storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    dispose = bootAppearance(browser);

    useAppearance().setThemePreference("dark");
    expect(useAppearance().appearance.value).toBe("dark");
    expect(browser.root.classes.has("p-dark")).toBe(true);
  });
});

describe("cross-tab sync", () => {
  let dispose: (() => void) | undefined;
  afterEach(() => dispose?.());

  it("follows a preference written by another tab", () => {
    const browser = fakeBrowser({ osDark: false });
    dispose = bootAppearance(browser);

    browser.storage.writeFromOtherTab(themePreferenceKey, "dark");
    expect(useAppearance().themePreference.value).toBe("dark");
    expect(useAppearance().appearance.value).toBe("dark");
    expect(browser.root.classes.has("p-dark")).toBe(true);
    expect(browser.root.themeColor.content).toBe(THEME_COLOR.dark);
  });

  it("another tab choosing System resumes following the OS here too", () => {
    const browser = fakeBrowser({ stored: "light", osDark: true });
    dispose = bootAppearance(browser);
    expect(browser.root.classes.has("p-dark")).toBe(false);

    browser.storage.writeFromOtherTab(themePreferenceKey, "system");
    expect(useAppearance().themePreference.value).toBe("system");
    expect(browser.root.classes.has("p-dark")).toBe(true);

    browser.query.change(false);
    expect(browser.root.classes.has("p-dark")).toBe(false);
  });

  it("another tab removing the key or clearing storage reads as System", () => {
    const browser = fakeBrowser({ stored: "dark", osDark: false });
    dispose = bootAppearance(browser);

    browser.storage.writeFromOtherTab(themePreferenceKey, null);
    expect(useAppearance().themePreference.value).toBe("system");
    expect(browser.root.classes.has("p-dark")).toBe(false);

    useAppearance().setThemePreference("dark");
    browser.storage.writeFromOtherTab(null, null);
    expect(useAppearance().themePreference.value).toBe("system");
    expect(browser.root.classes.has("p-dark")).toBe(false);
  });

  it("ignores storage events for other keys", () => {
    const browser = fakeBrowser({ stored: "dark", osDark: false });
    dispose = bootAppearance(browser);

    browser.storage.writeFromOtherTab("username", "someone");
    expect(useAppearance().themePreference.value).toBe("dark");
    expect(browser.root.classes.has("p-dark")).toBe(true);
  });

  it("stops listening for other tabs once disposed", () => {
    const browser = fakeBrowser({ osDark: false });
    bootAppearance(browser)();

    browser.storage.writeFromOtherTab(themePreferenceKey, "dark");
    expect(browser.root.classes.has("p-dark")).toBe(false);
  });
});
