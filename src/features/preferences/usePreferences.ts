import { useCallback, useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import { createLocalStorageStore } from "./storage";
import { defaultPreferences, resolveDensity, type UiPreferences } from "./types";

const storageKey = "stealth-ui-preferences";
const legacyKey = "stealth-preferences";

const uiStore = createLocalStorageStore<UiPreferences>(storageKey, defaultPreferences, {
  legacyKey,
});

function resolveTheme(theme: UiPreferences["theme"]) {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/**
 * Resolve the effective motion level. Reduced motion wins whenever either the
 * in-app toggle or the OS `prefers-reduced-motion` setting asks for it, so the
 * accessibility preference is honored even when the user has not flipped the
 * in-app switch. Pure so it can be unit tested without a DOM.
 */
export function resolveMotion(
  lowerMotion: boolean,
  prefersReducedMotion: boolean,
): "lower" | "full" {
  return lowerMotion || prefersReducedMotion ? "lower" : "full";
}

/**
 * Pure resolution of persisted preferences, shared by the hook and its tests.
 * Stored values are always merged over the current defaults so missing keys
 * stay predictable across sessions and app versions. The current key wins; the
 * legacy `stealth-preferences` key is migrated only when the current one is
 * absent. `corrupt` is true when the current key is present but unparseable, so
 * the caller can clear it.
 */
export function resolveStoredPreferences(
  current: string | null,
  legacy: string | null,
): { preferences: UiPreferences; corrupt: boolean } {
  if (current) {
    try {
      return { preferences: { ...defaultPreferences, ...JSON.parse(current) }, corrupt: false };
    } catch {
      return { preferences: defaultPreferences, corrupt: true };
    }
  }
  if (legacy) {
    try {
      return { preferences: { ...defaultPreferences, ...JSON.parse(legacy) }, corrupt: false };
    } catch {
      return { preferences: defaultPreferences, corrupt: false };
    }
  }
  return { preferences: defaultPreferences, corrupt: false };
}

export function usePreferences() {
  const snapshot = useSyncExternalStore(uiStore.subscribe, uiStore.getSnapshot, () =>
    JSON.stringify(defaultPreferences),
  );

  const preferences = useMemo<UiPreferences>(
    () => ({ ...defaultPreferences, ...JSON.parse(snapshot) }),
    [snapshot],
  );

  const setPreferences = useCallback(
    (
      value:
        | UiPreferences
        | Partial<UiPreferences>
        | ((prev: UiPreferences) => UiPreferences | Partial<UiPreferences>),
    ) => {
      const prev = uiStore.getValue();
      const patch = typeof value === "function" ? value(prev) : value;
      const next = { ...defaultPreferences, ...prev, ...patch };
      const changed = (Object.keys(next) as Array<keyof UiPreferences>).some(
        (k) => prev[k] !== next[k],
      );
      if (changed) uiStore.set(next);
    },
    [],
  );

  const theme = useMemo(() => resolveTheme(preferences.theme), [preferences.theme]);
  const density = useMemo(() => resolveDensity(preferences), [preferences]);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
    document.documentElement.dataset.glass = preferences.glassIntensity ?? "medium";
    document.documentElement.dataset.reader = preferences.readerTypography ?? "sans";
    document.documentElement.dataset.motion = preferences.lowerMotion ? "lower" : "full";

    const media = window.matchMedia("(prefers-color-scheme: light)");
    const listener = () => {
      if (preferences.theme === "system") {
        document.documentElement.dataset.theme = resolveTheme(preferences.theme);
      }
    };
    if (preferences.theme === "system") media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [
    theme,
    density,
    preferences.glassIntensity,
    preferences.readerTypography,
    preferences.lowerMotion,
    preferences.theme,
  ]);

  return { preferences, setPreferences, hydrated: true };
}
