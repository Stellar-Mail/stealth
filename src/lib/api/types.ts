// ---------------------------------------------------------------------------
// BETA-051 (Issue #1958) — typed web data-access DTOs.
//
// Client-side DTOs mirror the server domain schemas (`src/server/api/domain.ts`)
// so components consume typed interfaces instead of ad-hoc `any` fetches. They
// are intentionally decoupled from server modules (client bundles must never
// import `**/server/**`), so they are re-declared here and validated by the
// contract tests against the OpenAPI examples.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Auth & session
// ---------------------------------------------------------------------------

export type AccountStatus = "pending_verification" | "active" | "suspended" | "closed" | "invited";

export interface PublicUser {
  userId: string;
  address: string;
  email: string;
  username: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PublicSession {
  sessionId: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  lastActiveAt: string;
  absoluteExpiresAt?: string;
}

export interface SessionBundle {
  user: PublicUser;
  session: PublicSession;
}

export interface RegistrationResponse {
  accountStatus: "pending_verification";
  email: string;
  maskedEmail: string;
  username: string;
}

// ---------------------------------------------------------------------------
// Identity & key directory
// ---------------------------------------------------------------------------

export interface PublicProfile {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type KeyAlgorithm = "ed25519" | "x25519" | "secp256k1";
export type KeyPurpose = "encryption" | "signing" | "device";
export type KeyStatus = "active" | "rotated" | "retired" | "revoked";

export interface PublishedKey {
  keyId: string;
  owner: string;
  algorithm: KeyAlgorithm;
  purpose: KeyPurpose;
  publicKey: string;
  version: number;
  notBefore: string;
  notAfter: string;
  status: KeyStatus;
  signature: string;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string | null;
  revocationReason?: string | null;
  metadata?: Record<string, unknown>;
}

export interface KeyDirectoryRecord {
  owner: string;
  currentEncryptionKeyId: string | null;
  currentSigningKeyId: string | null;
  keys: PublishedKey[];
  updatedAt: string;
  version: number;
}

// ---------------------------------------------------------------------------
// Mailbox & messages
// ---------------------------------------------------------------------------

export type MailboxItemStatus = "pending" | "delivered";

export interface MailboxDescriptor {
  messageId: string;
  senderId: string;
  recipientId: string;
  status: MailboxItemStatus;
  createdAt: string;
  protectedHeaders: Record<string, unknown>;
  contentCommitment?: string;
  objectRef?: string;
  isTombstone: boolean;
  deletedAt?: string | null;
}

export interface MailboxQueueResponse {
  items: MailboxDescriptor[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Sender requests
// ---------------------------------------------------------------------------

export type UnknownSenderRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "blocked"
  | "expired";

export type UnknownSenderDecision = "approve_once" | "always_allow" | "reject" | "block" | "expire";

export interface EncryptedMessageReference {
  messageId: string;
  envelopeId?: string;
  ciphertextHash: string;
}

export interface UnknownSenderRequest {
  requestId: string;
  recipient: string;
  sender: string;
  message: EncryptedMessageReference;
  createdAt: string;
  expiresAt: string;
  status: UnknownSenderRequestStatus;
  decidedAt?: string;
  decision?: UnknownSenderDecision;
}

// ---------------------------------------------------------------------------
// Mailbox policy
// ---------------------------------------------------------------------------

export interface MailboxPolicy {
  allowUnknown: boolean;
  minimumPostage: string;
  requireVerified: boolean;
}

export interface MailboxPolicyWrite {
  allowUnknown: boolean;
  minimumPostage: string;
  requireVerified: boolean;
  requireReceipt?: boolean;
}

// ---------------------------------------------------------------------------
// Postage
// ---------------------------------------------------------------------------

export interface PostageQuote {
  amount: string;
  eligible: boolean;
  reason:
    | "trusted_sender"
    | "mailbox_minimum"
    | "sender_blocked"
    | "insufficient_balance"
    | "unknown_senders_disabled"
    | "verification_required"
    | "insufficient_postage";
  trusted: boolean;
  messageId?: string;
  asset?: string;
  policyVersion?: number;
  network?: string;
  fee?: { bps: number; amount: string };
  balance?: { available: string | null; sufficient: boolean | null };
  retryAfterSeconds?: number;
  issuedAt?: string;
  expiresAt?: string;
  digest?: string;
}

// ---------------------------------------------------------------------------
// Receipts & proof
// ---------------------------------------------------------------------------

export interface DeliveryReceipt {
  messageId: string;
  recipient: string;
  sender: string;
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export type ContactSource = "manual" | "csv" | "vcard" | "api";
export type ContactTrust = "default" | "allow" | "block";

export interface Contact {
  contactId: string;
  owner: string;
  name: string;
  address: string;
  canonicalAddress: string | null;
  trust: ContactTrust;
  source: ContactSource;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ContactCreateInput {
  name: string;
  address: string;
  trust?: ContactTrust;
}

export interface ContactListResponse {
  items: Contact[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Settings & preferences
// ---------------------------------------------------------------------------

export interface MailboxSettings {
  policy: MailboxPolicy;
  requireReceipt: boolean;
}

// ---------------------------------------------------------------------------
// BETA-019 — public managed-wallet status (no custody fields)
// ---------------------------------------------------------------------------

export type WalletActivationState = "pending" | "active" | "failed";
export type WalletStatusFreshness = "fresh" | "stale" | "unavailable";

export interface PublicWalletStatus {
  address: string;
  network: "testnet";
  networkPassphrase: string;
  balanceXlm: string | null;
  activation: WalletActivationState;
  lastSyncedAt: string | null;
  stale: boolean;
  freshness: WalletStatusFreshness;
}
