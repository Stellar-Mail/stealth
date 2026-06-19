import { useEffect, useState } from "react";
import { defaultPreferences, type UiPreferences } from "./types";

const storageKey = "stealth-ui-preferences";
const themePreferences = ["dark", "light", "system"] as const;
const densityPreferences = ["comfortable", "compact"] as const;
const glassIntensityPreferences = ["subtle", "medium", "strong"] as const;
const readerTypographyPreferences = ["sans", "serif", "large"] as const;
const unknownSenderPolicies = ["request", "verified", "block"] as const;
const receiptPreferences = ["auto", "manual", "never"] as const;

function resolveTheme(theme: UiPreferences["theme"]) {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function booleanOrDefault(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function allowedOrDefault<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  return typeof value === "string" && allowed.includes(value) ? (value as T[number]) : fallback;
}

export function normalizeUiPreferences(value: unknown): UiPreferences {
  const stored = isRecord(value) ? value : {};
  const storedReceipts = isRecord(stored.receipts) ? stored.receipts : {};
  const compactMode = booleanOrDefault(stored.compactMode, defaultPreferences.compactMode);
  const densityFallback = compactMode ? "compact" : defaultPreferences.density;

  return {
    theme: allowedOrDefault(stored.theme, themePreferences, defaultPreferences.theme),
    compactMode,
    density: allowedOrDefault(stored.density, densityPreferences, densityFallback),
    glassIntensity: allowedOrDefault(
      stored.glassIntensity,
      glassIntensityPreferences,
      defaultPreferences.glassIntensity,
    ),
    readerTypography: allowedOrDefault(
      stored.readerTypography,
      readerTypographyPreferences,
      defaultPreferences.readerTypography,
    ),
    lowerMotion: booleanOrDefault(stored.lowerMotion, defaultPreferences.lowerMotion),
    showAvatars: booleanOrDefault(stored.showAvatars, defaultPreferences.showAvatars),
    emailNotifications: booleanOrDefault(
      stored.emailNotifications,
      defaultPreferences.emailNotifications,
    ),
    desktopNotifications: booleanOrDefault(
      stored.desktopNotifications,
      defaultPreferences.desktopNotifications,
    ),
    sound: booleanOrDefault(stored.sound, defaultPreferences.sound),
    unknownSenders: allowedOrDefault(
      stored.unknownSenders,
      unknownSenderPolicies,
      defaultPreferences.unknownSenders,
    ),
    minimumPostage: stringOrDefault(stored.minimumPostage, defaultPreferences.minimumPostage),
    onboardingCompleted: booleanOrDefault(
      stored.onboardingCompleted,
      defaultPreferences.onboardingCompleted,
    ),
    receiptOnDelivery: booleanOrDefault(
      stored.receiptOnDelivery,
      defaultPreferences.receiptOnDelivery,
    ),
    receipts: {
      trusted: allowedOrDefault(
        storedReceipts.trusted,
        receiptPreferences,
        defaultPreferences.receipts.trusted,
      ),
      unknown: allowedOrDefault(
        storedReceipts.unknown,
        receiptPreferences,
        defaultPreferences.receipts.unknown,
      ),
      paid: allowedOrDefault(
        storedReceipts.paid,
        receiptPreferences,
        defaultPreferences.receipts.paid,
      ),
      organizations: allowedOrDefault(
        storedReceipts.organizations,
        receiptPreferences,
        defaultPreferences.receipts.organizations,
      ),
    },
  };
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
          stored = JSON.stringify(normalizeUiPreferences(JSON.parse(legacyStored)));
        } catch {
          // ignore
        }
      }
    }
    if (stored) {
      try {
        setPreferences(normalizeUiPreferences(JSON.parse(stored)));
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
