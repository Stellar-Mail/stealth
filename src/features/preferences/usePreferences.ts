import { useEffect, useState } from "react";
import { defaultPreferences, type UiPreferences } from "./types";

const storageKey = "stealth-ui-preferences";

function resolveTheme(theme: UiPreferences["theme"]) {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<UiPreferences>(defaultPreferences);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      const legacyStored = window.localStorage.getItem("stealth-preferences");
      if (legacyStored) {
        try {
          const parsed = JSON.parse(legacyStored);
          stored = JSON.stringify({ ...defaultPreferences, ...parsed });
        } catch {
          // ignore
        }
      }
    }
    if (stored) {
      try {
        setPreferences({ ...defaultPreferences, ...JSON.parse(stored) });
      } catch {
        window.localStorage.removeItem(storageKey);
      }
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
