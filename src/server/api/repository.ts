import type { IdempotencyRecord, MailboxPolicy, Postage, Receipt, SenderRule } from "./domain";

export interface ApiRepository {
  getPolicy(owner: string): Promise<MailboxPolicy | null>;
  setPolicy(owner: string, policy: MailboxPolicy): Promise<MailboxPolicy>;
  getSenderRule(owner: string, sender: string): Promise<SenderRule>;
  setSenderRule(owner: string, sender: string, rule: SenderRule): Promise<SenderRule>;
  getPostage(messageId: string): Promise<Postage | null>;
  setPostage(postage: Postage): Promise<Postage>;
  getReceipt(messageId: string): Promise<Receipt | null>;
  setReceipt(receipt: Receipt): Promise<Receipt>;
  getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null>;
  setIdempotencyRecord(key: string, record: IdempotencyRecord): Promise<void>;

  getRelayQueueDepth(relayId: string): Promise<number>;
  getRelayRetryCount(relayId: string): Promise<number>;
  getRelayLastSuccessfulDelivery(relayId: string): Promise<string | null>;
  getRelayLastFailedDelivery(relayId: string): Promise<string | null>;
  getRelayDeadLetterCount(relayId: string): Promise<number>;
  getCounter(key: string): Promise<number>;
  incrementCounter(key: string, windowSeconds: number): Promise<number>;
}

// ---------------------------------------------------------------------------
// Data Retention Rules
// ---------------------------------------------------------------------------

/**
 * Retention classes for API domain records.
 * Each persisted record type has a defined lifetime and cleanup behavior.
 */
export enum RetentionClass {
  /** Operational � kept while active, safe to delete when terminal (30d after completion). */
  Operational = "operational",
  /** Financial � must be preserved for audit (7 years). */
  Financial = "financial",
  /** Audit � immutable, retained for compliance (7 years). */
  Audit = "audit",
  /** Security � retained for incident investigation (1 year). */
  Security = "security",
}

export interface RetentionPolicy {
  recordType: string;
  retentionClass: RetentionClass;
  minRetentionMs: number;
  cleanupBehavior: "delete" | "anonymize" | "archive";
  sensitiveFields: string[];
}

/** Retention policies per record type. */
export const RETENTION_POLICIES: Record<string, RetentionPolicy> = {
  postage: {
    recordType: "postage",
    retentionClass: RetentionClass.Financial,
    minRetentionMs: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
    cleanupBehavior: "archive",
    sensitiveFields: [],
  },
  receipt: {
    recordType: "receipt",
    retentionClass: RetentionClass.Operational,
    minRetentionMs: 30 * 24 * 60 * 60 * 1000, // 30 days after completion
    cleanupBehavior: "delete",
    sensitiveFields: [],
  },
  idempotencyRecord: {
    recordType: "idempotencyRecord",
    retentionClass: RetentionClass.Operational,
    minRetentionMs: 24 * 60 * 60 * 1000, // 24 hours
    cleanupBehavior: "delete",
    sensitiveFields: [],
  },
  auditLog: {
    recordType: "auditLog",
    retentionClass: RetentionClass.Audit,
    minRetentionMs: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
    cleanupBehavior: "archive",
    sensitiveFields: [],
  },
  relayDiagnostics: {
    recordType: "relayDiagnostics",
    retentionClass: RetentionClass.Operational,
    minRetentionMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    cleanupBehavior: "delete",
    sensitiveFields: ["wallet", "address"],
  },
};

/**
 * Check if a record is eligible for cleanup based on its retention policy.
 */
export function isEligibleForCleanup(
  recordType: string,
  createdAt: number,
  now: number = Date.now(),
): boolean {
  const policy = RETENTION_POLICIES[recordType];
  if (!policy) return false;
  return now - createdAt >= policy.minRetentionMs;
}

/**
 * Anonymize sensitive fields in a record according to its retention policy.
 */
export function anonymizeRecord<T extends Record<string, unknown>>(
  recordType: string,
  record: T,
): T {
  const policy = RETENTION_POLICIES[recordType];
  if (!policy || policy.cleanupBehavior !== "anonymize") return record;
  const cleaned = { ...record };
  for (const field of policy.sensitiveFields) {
    if (field in cleaned) {
      (cleaned as Record<string, unknown>)[field] = "[REDACTED]";
    }
  }
  return cleaned;
}

export const defaultMailboxPolicy: MailboxPolicy = {
  allowUnknown: false,
  minimumPostage: "0",
  requireVerified: true,
};
