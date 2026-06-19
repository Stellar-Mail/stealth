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
