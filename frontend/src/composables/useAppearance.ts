import { readonly, ref } from "vue";
import { themePreferenceKey } from "@/modules/constants";

/** Theme preference: what the user chose. `system` follows the OS. */
export type ThemePreference = "system" | "light" | "dark";
/** Appearance: the light-or-dark the app is actually showing. */
export type Appearance = "light" | "dark";

export function resolveAppearance(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): Appearance {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

/** Anything unknown or corrupt in storage reads as System. */
function parseThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

/**
 * The browser pieces appearance touches. Injected so tests can drive
 * them (including firing a `change` on the media query) without
 * stubbing globals.
 */
export type AppearanceBrowser = {
  storage: Pick<Storage, "getItem" | "setItem">;
  /** Where the cross-tab `storage` event arrives (`window` in a browser). */
  storageEvents: StorageEventTarget;
  matchMedia: (query: string) => MediaQueryLike;
  /** The `<html>` element: carries `.p-dark`, `color-scheme`, and holds the theme-color meta. */
  root: AppearanceRoot;
};

/** The parts of a `StorageEvent` appearance reads. `key` is null when storage was cleared. */
export type StorageEventLike = { readonly key: string | null; readonly newValue: string | null };

export type StorageEventTarget = {
  addEventListener(type: "storage", listener: (event: StorageEventLike) => void): void;
  removeEventListener(type: "storage", listener: (event: StorageEventLike) => void): void;
};

export type MediaQueryLike = {
  readonly matches: boolean;
  addEventListener(type: "change", listener: (event: { matches: boolean }) => void): void;
  removeEventListener(type: "change", listener: (event: { matches: boolean }) => void): void;
};

export type AppearanceRoot = {
  classList: { toggle(token: string, force?: boolean): boolean };
  style: { colorScheme: string };
  querySelector(selector: string): { setAttribute(name: string, value: string): void } | null;
  /** Reading it forces a synchronous style recalculation. */
  readonly offsetHeight: number;
};

const OS_DARK_QUERY = "(prefers-color-scheme: dark)";
/** The page background per appearance (`--surface-page` in base.scss),
 *  so mobile browser chrome matches the page. Mirrored in index.html. */
export const THEME_COLOR: Record<Appearance, string> = { light: "#f1f5f9", dark: "#18181b" };

// Module scope so the whole app shares one preference and one appearance.
const themePreference = ref<ThemePreference>("system");
const appearance = ref<Appearance>("light");
// What a preference change needs to take effect; wired by bootAppearance.
// Before boot (or after dispose) there is no root or storage to touch.
const unbootedCommit = (next: ThemePreference) => {
  themePreference.value = next;
};
let commitPreference = unbootedCommit;

function applyAppearance(root: AppearanceRoot, next: Appearance) {
  appearance.value = next;
  // PrimeVue components tween background/colour over 0.2s, which would
  // make a switch ripple through the page. Hold transitions off (see
  // base.scss) while the new appearance is computed, then let them go.
  root.classList.toggle("appearance-switching", true);
  // .p-dark is PrimeVue's configured darkModeSelector; color-scheme makes
  // native scrollbars and form controls follow.
  root.classList.toggle("p-dark", next === "dark");
  root.style.colorScheme = next;
  root.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[next]);
  void root.offsetHeight;
  root.classList.toggle("appearance-switching", false);
}

function readStoredPreference(storage: Pick<Storage, "getItem">): unknown {
  // Storage can throw (disabled, private mode); an unreadable preference is System.
  try {
    return storage.getItem(themePreferenceKey);
  } catch {
    return null;
  }
}

function writeStoredPreference(storage: Pick<Storage, "setItem">, next: ThemePreference) {
  // Storage can refuse the write (disabled, full); the choice still applies to this tab.
  try {
    storage.setItem(themePreferenceKey, next);
  } catch {
    // Not persisted; the next boot reads whatever was there before.
  }
}

function defaultBrowser(): AppearanceBrowser {
  return {
    // Accessed lazily: merely touching window.localStorage can throw when
    // storage is disabled, and that must read as System, not abort boot.
    storage: {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
    },
    storageEvents: window,
    matchMedia: (query) => window.matchMedia(query),
    root: document.documentElement,
  };
}

/**
 * Boot appearance once from the app root. Reads the stored preference,
 * applies the resolved appearance, and keeps it in step with the OS and
 * with other tabs of the app. Returns a disposer that stops both.
 */
export function bootAppearance(browser: AppearanceBrowser = defaultBrowser()): () => void {
  const { storage, storageEvents, matchMedia, root } = browser;
  const osDarkQuery = matchMedia(OS_DARK_QUERY);
  const apply = (systemPrefersDark: boolean) =>
    applyAppearance(root, resolveAppearance(themePreference.value, systemPrefersDark));

  // A preference change from anywhere — this tab or another — lands here.
  const takePreference = (next: ThemePreference) => {
    themePreference.value = next;
    apply(osDarkQuery.matches);
  };
  takePreference(parseThemePreference(readStoredPreference(storage)));
  commitPreference = (next) => {
    takePreference(next);
    writeStoredPreference(storage, next);
  };

  // Scheduled/sunset OS appearances flip while a tab is open; re-apply at once.
  const onChange = (event: { matches: boolean }) => apply(event.matches);
  osDarkQuery.addEventListener("change", onChange);
  // Another tab changed the preference (or cleared storage): the same
  // "it changed under me" path as an OS flip. `storage` only fires in
  // *other* tabs, so this never echoes our own write.
  const onStorage = (event: StorageEventLike) => {
    if (event.key !== null && event.key !== themePreferenceKey) return;
    takePreference(parseThemePreference(event.newValue));
  };
  storageEvents.addEventListener("storage", onStorage);

  return () => {
    osDarkQuery.removeEventListener("change", onChange);
    storageEvents.removeEventListener("storage", onStorage);
    commitPreference = unbootedCommit;
  };
}

export function useAppearance() {
  return {
    themePreference: readonly(themePreference),
    appearance: readonly(appearance),
    /** Apply and persist the user's choice. Instant; `system` resumes following the OS. */
    setThemePreference: (next: ThemePreference) => commitPreference(next),
  };
}
