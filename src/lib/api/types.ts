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
  avatarMetadata?: Record<string, unknown> | null;
  bio?: string | null;
  locale?: string;
  timezone?: string;
  addressDisplay?: "full" | "truncated";
  notifications?: {
    email: boolean;
    desktop: boolean;
    sound: boolean;
  };
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

export interface ResolutionFreshness {
  resolvedAt: string;
  cached: boolean;
  ttlMs: number;
  source: "stealth_local" | "stellar_federation" | "direct_address" | "negative_cache";
  expiresAt: string;
}

export interface ResolutionError {
  code:
    | "not_found"
    | "suspended"
    | "deactivated"
    | "pending_verification"
    | "timeout"
    | "invalid_format"
    | "network_error";
  message: string;
}

export interface ResolvedIdentity {
  identifier: string;
  canonicalAddress: string;
  account: string | null;
  resolved: boolean;
  status: AccountStatus | "unknown";
  publicKey: string | null;
  encryptionKeyVersion: number | null;
  policyEndpoint: string | null;
  policy?: MailboxPolicy | null;
  profile?: PublicProfile | null;
  memo?: string;
  memoType?: "text" | "id" | "hash";
  freshness: ResolutionFreshness;
  error?: ResolutionError;
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
  starred?: boolean;
  unread?: boolean;
  folder?: MailboxLiveFolder;
}

/** Recipient-only sealed envelope used by the live reader (BETA-055). */
export interface MailboxSealedMessage extends MailboxDescriptor {
  ciphertext: string;
  payload: unknown;
  signature?: unknown;
}

export type MailboxLiveFolder =
  | "inbox"
  | "pending"
  | "requests"
  | "archive"
  | "spam"
  | "trash"
  | "sent"
  | "drafts"
  | "outbox";

export type MailboxCountKey =
  | "inbox"
  | "requests"
  | "sent"
  | "drafts"
  | "outbox"
  | "archive"
  | "spam"
  | "trash"
  | "unread"
  | "starred";

export type MailboxCounts = Record<MailboxCountKey, number>;

export interface MailboxFlagsPatch {
  unread?: boolean;
  starred?: boolean;
  folder?: "inbox" | "archive" | "spam" | "trash";
}

export interface MailboxQueueResponse {
  items: MailboxDescriptor[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface MailboxSyncResponse {
  items: MailboxDescriptor[];
  deletedIds: string[];
  nextCursor: string | null;
  hasMore: boolean;
  syncCursor: string;
  counts: MailboxCounts;
}

export interface MailboxCountsResponse {
  counts: MailboxCounts;
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
  postageAmount?: string;
  verifiedSender?: boolean;
  proofSummary?: string;
}

export interface UnknownSenderRequestsResponse {
  items: UnknownSenderRequest[];
  nextCursor: string | null;
  hasMore: boolean;
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
  version?: number;
}

export type SenderRule = "default" | "allow" | "block";

export type PolicyWriteStatus = "pending" | "submitted" | "confirmed" | "failed";

export type PolicyReconciliationState =
  | "synced"
  | "pending_write"
  | "failed"
  | "diverged"
  | "not_provisioned"
  | "chain_ahead";

export interface PolicyWriteIntent {
  status: PolicyWriteStatus;
  version: number;
  policy: MailboxPolicy & { requireReceipt?: boolean };
  scheduledAt: string;
  updatedAt: string;
  failureCount: number;
  lastError: string | null;
  txHash?: string | null;
}

export interface PolicyReconciliation {
  owner: string;
  state: PolicyReconciliationState;
  offchain: {
    policy: MailboxPolicy | null;
    source: "default" | "configured" | null;
    version: number | null;
    intentStatus: PolicyWriteStatus | null;
    intentUpdatedAt: string | null;
    intentError: string | null;
  };
  chain: {
    policy: MailboxPolicy | null;
    version: number | null;
  };
  writeIntent: PolicyWriteIntent | null;
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

export type PostageStatus =
  | "pending"
  | "expired"
  | "disputed"
  | "settled"
  | "refunded"
  | "reclaimed";

export interface PostageRecord {
  amount: string;
  createdAt: string;
  messageId: string;
  paymentHash: string;
  recipient: string;
  sender: string;
  status: PostageStatus;
}

// ---------------------------------------------------------------------------
// Receipts & proof
// ---------------------------------------------------------------------------

export interface DeliveryReceipt {
  messageId: string;
  recipient: string;
  sender: string;
}

/** Delivery/read receipt persisted by the receipts service (BETA-044). */
export interface ReceiptRecord {
  deliveredAt: string;
  messageId: string;
  readAt: string | null;
  recipient: string;
  sender: string;
  payloadHash?: string;
  protocolVersion?: number;
  txHash?: string | null;
  chainStatus?: "pending" | "confirmed" | "failed" | null;
  ledgerSeq?: number | null;
  confirmedAt?: string | null;
}

export type LifecycleAnchorStatus = "pending" | "submitted" | "confirmed" | "failed";

/** On-chain lifecycle anchor for a message (BETA-043). */
export interface LifecycleAnchorRecord {
  messageId: string;
  sender: string;
  recipient: string;
  amount: string;
  verified: boolean;
  receiptRequired: boolean;
  status: LifecycleAnchorStatus;
  scheduledAt: string;
  updatedAt: string;
  failureCount: number;
  lastError: string | null;
  txHash: string | null;
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
// BETA-069 — account settings DTOs
// ---------------------------------------------------------------------------

export type AddressDisplay = "full" | "truncated";

export interface AccountInfo {
  userId: string;
  username: string;
  address: string;
  email: string;
  status: AccountStatus;
  createdAt: string;
  network: string;
  policyVersion: number | null;
  betaLimitations: string[];
}

export interface ProfileUpdateInput {
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  avatarMetadata?: Record<string, unknown> | null;
  locale?: string;
  timezone?: string;
  addressDisplay?: AddressDisplay;
  notifications?: {
    email?: boolean;
    desktop?: boolean;
    sound?: boolean;
  };
  version: number;
}

export interface AccountProfileResponse {
  user: PublicUser;
  profile: PublicProfile;
  account: AccountInfo;
}

export interface ProfileUpdateResponse {
  profile: PublicProfile;
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
