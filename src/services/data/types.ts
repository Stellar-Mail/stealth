import type { MailLocation, Email, SenderPolicy } from "@/components/mail/data";

/**
 * Core data types for offline-first mailbox state.
 * These types define the contracts for repositories.
 */

/**
 * Message represents a single email message with all metadata.
 * Extends the existing Email type with additional fields for persistence.
 */
export type Message = Email & {
  /** ISO timestamp for creation/update tracking */
  createdAt?: string;
  updatedAt?: string;
  /** Sync state for offline support */
  syncStatus?: "synced" | "pending" | "failed";
  syncError?: string;
};

/**
 * Thread represents a conversation thread (multiple related messages).
 */
export type Thread = {
  id: string;
  subject: string;
  messageIds: string[];
  preview: string;
  unreadCount: number;
  starred: boolean;
  participants: string[];
  lastMessageAt: string;
  updatedAt: string;
};

/**
 * Contact represents a sender/recipient contact.
 */
export type Contact = {
  id: string;
  email: string;
  name?: string;
  avatarColor?: string;
  stellarAddress?: string;
  /** Policy applied to messages from this contact */
  policy?: SenderPolicy;
  /** When contact was first seen */
  firstSeen: string;
  /** Last interaction timestamp */
  lastInteraction?: string;
};

/**
 * SenderPolicy record for tracking sender conversion decisions.
 */
export type SenderPolicyRecord = {
  id: string;
  contactId: string;
  email: string;
  policy: SenderPolicy;
  appliedAt: string;
  reason?: string;
};

/**
 * Proof record for verified sender identity proofs.
 */
export type ProofRecord = {
  id: string;
  messageId: string;
  contactId: string;
  proofHash: string;
  status: "valid" | "pending" | "failed";
  verifiedAt?: string;
  expiresAt?: string;
};

/**
 * SyncCursor tracks sync state for offline-first synchronization.
 */
export type SyncCursor = {
  id: string;
  sourceId: string;
  /** Last successfully synced timestamp */
  lastSyncedAt: string;
  /** Next expected sync */
  nextSyncAt?: string;
  /** Number of pending changes */
  pendingChanges: number;
};

/**
 * LoadingState represents async operation states.
 */
export type LoadingState = "idle" | "loading" | "loaded" | "error" | "offline";

/**
 * MailboxState represents the overall state of the mailbox.
 */
export type MailboxState = {
  messages: Message[];
  threads: Thread[];
  contacts: Contact[];
  policies: SenderPolicyRecord[];
  proofs: ProofRecord[];
  syncCursors: SyncCursor[];
  loadingState: LoadingState;
  error?: string;
  isOffline: boolean;
};

/**
 * IdempotentMutation ensures mutations can be safely retried.
 */
export type IdempotentMutation<T> = {
  id: string;
  timestamp: string;
  operation: "create" | "update" | "delete";
  entityType: "message" | "contact" | "policy" | "proof";
  data: T;
  /** Hash for deduplication */
  hash: string;
};
