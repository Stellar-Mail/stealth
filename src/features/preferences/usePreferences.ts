import { useEffect, useState } from "react";
import { defaultPreferences, type UiPreferences } from "./types";

const storageKey = "stealth-ui-preferences";

function resolveTheme(theme: UiPreferences["theme"]) {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
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
  const [preferences, setPreferences] = useState<UiPreferences>(defaultPreferences);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const { preferences: resolved, corrupt } = resolveStoredPreferences(
      window.localStorage.getItem(storageKey),
      window.localStorage.getItem("stealth-preferences"),
    );
    if (corrupt) {
      window.localStorage.removeItem(storageKey);
    } else {
      setPreferences(resolved);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(preferences.theme);
      const density = preferences.density ?? (preferences.compactMode ? "compact" : "comfortable");
      document.documentElement.dataset.density = density;
      document.documentElement.dataset.glass = preferences.glassIntensity ?? "medium";
      document.documentElement.dataset.reader = preferences.readerTypography ?? "sans";
      document.documentElement.dataset.motion = preferences.lowerMotion ? "lower" : "full";
    };

    apply();
    window.localStorage.setItem(storageKey, JSON.stringify(preferences));

    const media = window.matchMedia("(prefers-color-scheme: light)");
    if (preferences.theme === "system") media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [hydrated, preferences]);

  return { preferences, setPreferences, hydrated };
}
