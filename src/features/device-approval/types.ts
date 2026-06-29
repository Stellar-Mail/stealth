export interface DeviceMetadata {
  deviceName: string;
  deviceType: string;
  browser: string;
  operatingSystem: string;
  ipAddress: string;
  location: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  required: boolean;
}

export interface WalletIdentity {
  address: string;
  network: string;
  balance?: string;
}

export interface RelayChallenge {
  id: string;
  expiresAt: Date;
  relaySource: string;
  otpCode?: string;
}

export interface DeviceApprovalRequest {
  id: string;
  deviceMetadata: DeviceMetadata;
  permissions: Permission[];
  walletIdentity: WalletIdentity;
  relayChallenge: RelayChallenge;
  requestedAt: Date;
}

export type ApprovalAction = "approve" | "deny" | "report";

export type VerificationState = 
  | "idle" 
  | "pending" 
  | "success" 
  | "failure" 
  | "expired";
