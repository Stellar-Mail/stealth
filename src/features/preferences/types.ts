export type ThemePreference = "dark" | "light" | "system";
export type UnknownSenderPolicy = "request" | "verified" | "block";
export type StellarNetwork = "mainnet" | "testnet";

export type UiPreferences = {
  theme: ThemePreference;
  compactMode: boolean;
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
  showAvatars: true,
  emailNotifications: true,
  desktopNotifications: true,
  sound: false,
  unknownSenders: "request",
  minimumPostage: "0.0001",
  onboardingCompleted: false,
  receiptOnDelivery: false,
  actorAddress: null,
};
