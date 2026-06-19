import { useCallback, useEffect, useState } from "react";
import { defaultLayoutPreferences, type LayoutPreferences } from "./layout-types";

const storageKey = "stealth-layout-preferences";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function finiteNumberOrDefault(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanOrDefault(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function clampPreferences(prefs: LayoutPreferences): LayoutPreferences {
  return {
    ...prefs,
    sidebarWidth: clamp(prefs.sidebarWidth, 5, 40),
    listWidth: clamp(prefs.listWidth, 10, 60),
    readerWidth: clamp(prefs.readerWidth, 15, 80),
  };
}

export function normalizeLayoutPreferences(value: unknown): LayoutPreferences {
  const stored = isRecord(value) ? value : {};

  return clampPreferences({
    sidebarWidth: finiteNumberOrDefault(stored.sidebarWidth, defaultLayoutPreferences.sidebarWidth),
    sidebarCollapsed: booleanOrDefault(
      stored.sidebarCollapsed,
      defaultLayoutPreferences.sidebarCollapsed,
    ),
    listWidth: finiteNumberOrDefault(stored.listWidth, defaultLayoutPreferences.listWidth),
    readerWidth: finiteNumberOrDefault(stored.readerWidth, defaultLayoutPreferences.readerWidth),
    compactMode: booleanOrDefault(stored.compactMode, defaultLayoutPreferences.compactMode),
    rightPanelCollapsed: booleanOrDefault(
      stored.rightPanelCollapsed,
      defaultLayoutPreferences.rightPanelCollapsed,
    ),
  });
}

export function useLayoutPreferences() {
  const [layout, setLayout] = useState<LayoutPreferences>(defaultLayoutPreferences);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try {
        setLayout(normalizeLayoutPreferences(JSON.parse(stored)));
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(layout));
  }, [hydrated, layout]);

  const setLayoutPreference = useCallback((patch: Partial<LayoutPreferences>) => {
    setLayout((prev: LayoutPreferences) => {
      const next = clampPreferences({ ...prev, ...patch });
      // Only create a new object when at least one value actually changed.
      const changed = (Object.keys(next) as Array<keyof LayoutPreferences>).some(
        (k) => prev[k] !== next[k],
      );
      if (!changed) return prev;
      return next;
    });
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(defaultLayoutPreferences);
  }, []);

  return { layout, setLayout: setLayoutPreference, resetLayout, hydrated };
}
