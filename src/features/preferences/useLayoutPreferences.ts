import { useCallback, useEffect, useRef, useState } from "react";
import { defaultLayoutPreferences, type LayoutPreferences } from "./layout-types";

const storageKey = "stealth-layout-preferences";

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  const clamped = Math.min(Math.max(numericValue, min), max);
  return Math.round(clamped * 100) / 100;
}

function clampPreferences(prefs: LayoutPreferences): LayoutPreferences {
  return {
    ...prefs,
    sidebarWidth: clamp(prefs.sidebarWidth, 5, 40, defaultLayoutPreferences.sidebarWidth),
    listWidth: clamp(prefs.listWidth, 10, 60, defaultLayoutPreferences.listWidth),
    readerWidth: clamp(prefs.readerWidth, 15, 80, defaultLayoutPreferences.readerWidth),
  };
}

function isSameLayout(a: LayoutPreferences, b: LayoutPreferences) {
  return (Object.keys(defaultLayoutPreferences) as Array<keyof LayoutPreferences>).every((key) =>
    Object.is(a[key], b[key]),
  );
}

export function useLayoutPreferences() {
  const [layout, setLayout] = useState<LayoutPreferences>(defaultLayoutPreferences);
  const [hydrated, setHydrated] = useState(false);
  const layoutRef = useRef(layout);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const next = clampPreferences({ ...defaultLayoutPreferences, ...parsed });
        layoutRef.current = next;
        setLayout(next);
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
    const next = clampPreferences({ ...layoutRef.current, ...patch });
    if (isSameLayout(layoutRef.current, next)) return;
    layoutRef.current = next;
    setLayout(next);
  }, []);

  const resetLayout = useCallback(() => {
    if (isSameLayout(layoutRef.current, defaultLayoutPreferences)) return;
    layoutRef.current = defaultLayoutPreferences;
    setLayout(defaultLayoutPreferences);
  }, []);

  return { layout, setLayout: setLayoutPreference, resetLayout, hydrated };
}
