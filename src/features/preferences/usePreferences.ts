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
    const stored = window.localStorage.getItem(storageKey);
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
      document.documentElement.dataset.density = preferences.compactMode
        ? "compact"
        : "comfortable";
    };

    apply();
    window.localStorage.setItem(storageKey, JSON.stringify(preferences));

    const media = window.matchMedia("(prefers-color-scheme: light)");
    if (preferences.theme === "system") media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [hydrated, preferences]);

  return { preferences, setPreferences, hydrated };
}
