import { describe, expect, it } from "vitest";
import { defaultLayoutPreferences } from "./layout-types";
import { normalizeLayoutPreferences } from "./useLayoutPreferences";
import { defaultPreferences } from "./types";
import { normalizeUiPreferences } from "./usePreferences";

describe("preference normalization", () => {
  it("keeps receipt defaults when a stored UI preference record is partial", () => {
    const preferences = normalizeUiPreferences({
      compactMode: true,
      onboardingCompleted: true,
      receipts: {
        unknown: "never",
      },
    });

    expect(preferences).toEqual({
      ...defaultPreferences,
      compactMode: true,
      density: "compact",
      onboardingCompleted: true,
      receipts: {
        ...defaultPreferences.receipts,
        unknown: "never",
      },
    });
  });

  it("falls back to defaults for unsupported UI preference values", () => {
    const preferences = normalizeUiPreferences({
      theme: "neon",
      density: "dense",
      glassIntensity: "opaque",
      readerTypography: "comic",
      lowerMotion: "yes",
      showAvatars: "false",
      unknownSenders: "accept-all",
      minimumPostage: 0.25,
      receipts: {
        trusted: "always",
        paid: "sometimes",
      },
    });

    expect(preferences).toEqual(defaultPreferences);
  });

  it("clamps stored layout widths and restores missing values from defaults", () => {
    const layout = normalizeLayoutPreferences({
      sidebarWidth: 100,
      sidebarCollapsed: true,
      listWidth: "wide",
      readerWidth: Number.NaN,
      rightPanelCollapsed: true,
    });

    expect(layout).toEqual({
      ...defaultLayoutPreferences,
      sidebarWidth: 40,
      sidebarCollapsed: true,
      rightPanelCollapsed: true,
    });
  });
});
