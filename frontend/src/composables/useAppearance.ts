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
export function parseThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

/**
 * The browser pieces appearance touches. Injected so tests can drive
 * them (including firing a `change` on the media query) without
 * stubbing globals.
 */
export type AppearanceBrowser = {
  storage: Pick<Storage, "getItem">;
  matchMedia: (query: string) => MediaQueryLike;
  /** The `<html>` element: carries `.p-dark`, `color-scheme`, and holds the theme-color meta. */
  root: AppearanceRoot;
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
};

const OS_DARK_QUERY = "(prefers-color-scheme: dark)";
/** The page background per appearance (`--surface-page` in base.scss),
 *  so mobile browser chrome matches the page. Mirrored in index.html. */
const THEME_COLOR: Record<Appearance, string> = { light: "#f1f5f9", dark: "#18181b" };

// Module scope so the whole app shares one preference and one appearance.
const themePreference = ref<ThemePreference>("system");
const appearance = ref<Appearance>("light");

function applyAppearance(root: AppearanceRoot, next: Appearance) {
  appearance.value = next;
  // .p-dark is PrimeVue's configured darkModeSelector; color-scheme makes
  // native scrollbars and form controls follow.
  root.classList.toggle("p-dark", next === "dark");
  root.style.colorScheme = next;
  root.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[next]);
}

function readStoredPreference(storage: Pick<Storage, "getItem">): unknown {
  // Storage can throw (disabled, private mode); an unreadable preference is System.
  try {
    return storage.getItem(themePreferenceKey);
  } catch {
    return null;
  }
}

function defaultBrowser(): AppearanceBrowser {
  return {
    storage: localStorage,
    matchMedia: (query) => window.matchMedia(query),
    root: document.documentElement,
  };
}

/**
 * Boot appearance once from the app root. Reads the stored preference,
 * applies the resolved appearance, and keeps it in step with the OS.
 * Returns a disposer that stops following the OS.
 */
export function bootAppearance(browser: AppearanceBrowser = defaultBrowser()): () => void {
  const { storage, matchMedia, root } = browser;
  themePreference.value = parseThemePreference(readStoredPreference(storage));
  const osDark = matchMedia(OS_DARK_QUERY);
  const apply = (systemPrefersDark: boolean) =>
    applyAppearance(root, resolveAppearance(themePreference.value, systemPrefersDark));
  apply(osDark.matches);
  // Scheduled/sunset OS themes flip while a tab is open; re-apply at once.
  const onChange = (event: { matches: boolean }) => apply(event.matches);
  osDark.addEventListener("change", onChange);
  return () => osDark.removeEventListener("change", onChange);
}

export function useAppearance() {
  return {
    themePreference: readonly(themePreference),
    appearance: readonly(appearance),
  };
}
