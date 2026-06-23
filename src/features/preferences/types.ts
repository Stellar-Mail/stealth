export type ThemePreference = "dark" | "light" | "system";
export type DensityPreference = "comfortable" | "compact";
export type GlassIntensityPreference = "subtle" | "medium" | "strong";
export type ReaderTypographyPreference = "sans" | "serif" | "large";
export type UnknownSenderPolicy = "request" | "verified" | "block";

export type ReceiptPreference = "auto" | "manual" | "never";

export type UiPreferences = {
  theme: ThemePreference;
  compactMode: boolean;
  density: DensityPreference;
  glassIntensity: GlassIntensityPreference;
  readerTypography: ReaderTypographyPreference;
  lowerMotion: boolean;
  showAvatars: boolean;
  emailNotifications: boolean;
  desktopNotifications: boolean;
  sound: boolean;
  unknownSenders: UnknownSenderPolicy;
  minimumPostage: string;
  onboardingCompleted: boolean;
  receiptOnDelivery: boolean;
  receipts: {
    trusted: ReceiptPreference;
    unknown: ReceiptPreference;
    paid: ReceiptPreference;
    organizations: ReceiptPreference;
  };
};

export const defaultPreferences: UiPreferences = {
  theme: "dark",
  compactMode: false,
  density: "comfortable",
  glassIntensity: "medium",
  readerTypography: "sans",
  lowerMotion: false,
  showAvatars: true,
  receiptOnDelivery: false,
  emailNotifications: true,
  desktopNotifications: true,
  sound: false,
  unknownSenders: "request",
  minimumPostage: "0.0001",
  onboardingCompleted: false,
  receipts: {
    trusted: "auto",
    unknown: "manual",
    paid: "manual",
    organizations: "auto",
  },
};

/**
 * Derive the active density value from the legacy `compactMode` flag and the
 * newer `density` field. Centralising this keeps the rest of the app from
 * repeating the same fallback inline.
 */
export function resolveDensity(
  prefs: Pick<UiPreferences, "density" | "compactMode">,
): DensityPreference {
  return prefs.density ?? (prefs.compactMode ? "compact" : "comfortable");
}
