export type NetworkType = "testnet" | "mainnet" | "custom";

export type SyncState = "synced" | "syncing" | "error" | "offline";

export type AccountProfile = {
  id: string;
  label: string;
  /** Stellar public key or federation address (e.g. GABCD…1234). */
  address: string;
  /** Human-friendly federation-style identifier, e.g. eve*stealth.xyz. */
  federationAddress?: string;
  network: NetworkType;
  avatarInitials: string;
  avatarColor: string;
  isPinned: boolean;
  syncState: SyncState;
  lastSyncedAt?: string;
  createdAt: string;
};

export type AccountSwitcherDraftState = {
  hasUnsentDrafts: boolean;
  hasPendingApprovals: boolean;
};