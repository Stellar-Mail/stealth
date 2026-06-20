export type ThemePreference = "dark" | "light" | "system";
export type DensityPreference = "comfortable" | "compact";
export type GlassIntensityPreference = "subtle" | "medium" | "strong";
export type ReaderTypographyPreference = "sans" | "serif" | "large";
export type UnknownSenderPolicy = "request" | "verified" | "block";
export type StellarNetwork = "mainnet" | "testnet";

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
  // Actor address derived from wallet connection, null when disconnected
  actorAddress: string | null;
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
  receiptOnDelivery: false,
  actorAddress: null,
};
