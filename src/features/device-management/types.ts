export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";
export type KeyStatus = "active" | "compromised" | "revoked" | "rotated";

export interface Device {
  id: string;
  address: string;
  name: string;
  type: DeviceType;
  fingerprint: string;
  publicKey: string;
  keyStatus: KeyStatus;
  trusted: boolean;
  lastActive: string;
  lastIp: string;
  lastLocation: string;
  createdAt: string;
  isCurrent: boolean;
  sessions: Session[];
}

export interface Session {
  id: string;
  deviceId: string;
  address: string;
  startedAt: string;
  lastActiveAt: string;
  ip: string;
  location: string;
  isCurrent: boolean;
  revokedAt: string | null;
}

export interface RecoveryStatus {
  enabled: boolean;
  lastUpdated: string | null;
  devicesCount: number;
  trustedCount: number;
}
