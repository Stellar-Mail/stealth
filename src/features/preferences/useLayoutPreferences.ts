import { useCallback, useMemo, useSyncExternalStore } from "react";
import { createLocalStorageStore } from "./storage";
import { defaultLayoutPreferences, type LayoutPreferences } from "./layout-types";

const storageKey = "stealth-layout-preferences";

const layoutStore = createLocalStorageStore<LayoutPreferences>(
  storageKey,
  defaultLayoutPreferences,
);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function clampLayoutPreferences(prefs: LayoutPreferences): LayoutPreferences {
  return {
    ...prefs,
    sidebarWidth: clamp(prefs.sidebarWidth, 5, 40),
    listWidth: clamp(prefs.listWidth, 10, 60),
    readerWidth: clamp(prefs.readerWidth, 15, 80),
  };
}

export function useLayoutPreferences() {
  const snapshot = useSyncExternalStore(layoutStore.subscribe, layoutStore.getSnapshot, () =>
    JSON.stringify(defaultLayoutPreferences),
  );

  const layout = useMemo<LayoutPreferences>(
    () => clampPreferences({ ...defaultLayoutPreferences, ...JSON.parse(snapshot) }),
    [snapshot],
  );

  const setLayout = useCallback((patch: Partial<LayoutPreferences>) => {
    const prev = layoutStore.getValue();
    const next = clampPreferences({ ...prev, ...patch });
    const changed = (Object.keys(patch) as Array<keyof LayoutPreferences>).some(
      (k) => prev[k] !== next[k],
    );
    if (changed) layoutStore.set(next);
  }, []);

  const resetLayout = useCallback(() => {
    layoutStore.set(defaultLayoutPreferences);
  }, []);

  return { layout, setLayout, resetLayout, hydrated: true };
}
