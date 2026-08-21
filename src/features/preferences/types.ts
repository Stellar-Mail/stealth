export type ThemePreference = "dark" | "light" | "system";
export type DensityPreference = "comfortable" | "compact";
export type GlassIntensityPreference = "subtle" | "medium" | "strong";
export type ReaderTypographyPreference = "sans" | "serif" | "large";

export type UnknownSenderPolicy = "request" | "verified" | "block";
export type ReceiptPreference = "auto" | "manual" | "never";
export type NotificationCategory = "mail" | "requests" | "failures" | "receipts";

export type NotificationPreferences = {
  categories: Record<NotificationCategory, boolean>;
  quietHours: { enabled: boolean; start: string; end: string };
};

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
  notifications: NotificationPreferences;
  onboardingCompleted: boolean;
  receiptOnDelivery: boolean;
  receipts: {
    trusted: ReceiptPreference;
    unknown: ReceiptPreference;
    paid: ReceiptPreference;
    organizations: ReceiptPreference;
  };
  unknownSenders: UnknownSenderPolicy;
  minimumPostage: string;
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
  notifications: {
    categories: { mail: true, requests: true, failures: true, receipts: true },
    quietHours: { enabled: false, start: "22:00", end: "07:00" },
  },
  onboardingCompleted: false,
  receipts: {
    trusted: "auto",
    unknown: "manual",
    paid: "manual",
    organizations: "auto",
  },
  unknownSenders: "request",
  minimumPostage: "0.01",
};
