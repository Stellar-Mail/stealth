/**
 * Mailbox incremental-sync domain types (Issue #1941 BETA-034).
 *
 * Initial sync, delta sync, tombstones, and cursor expiry are defined here so
 * the persistence adapters, ingestion worker, HTTP transport, and client engine
 * share one contract. Ciphertext may appear on upsert events; plaintext and
 * quarantined payloads never do.
 */
import { z } from "zod";

import { hash32Schema, stellarAddressSchema } from "@/server/api/domain";

/** Signed cursor lifetime. Expired cursors force a bounded full resync. */
export const SYNC_CURSOR_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Default / maximum page sizes for both initial and delta walks. */
export const DEFAULT_SYNC_PAGE_SIZE = 100;
export const MAX_SYNC_PAGE_SIZE = 200;

/**
 * Upper bound on events retained for delta replay. A cursor whose seq falls
 * below the compacted watermark is treated as expired even if its TTL has not
 * elapsed, so a reconnect never walks an unbounded history.
 */
export const FULL_RESYNC_EVENT_BOUND = 500;

export const DEVICE_ID_MAX_LENGTH = 128;

export const deviceIdSchema = z
  .string()
  .trim()
  .min(1, "deviceId is required")
  .max(DEVICE_ID_MAX_LENGTH, `deviceId exceeds ${DEVICE_ID_MAX_LENGTH} characters`)
  .regex(/^[A-Za-z0-9._:-]+$/, "deviceId contains unsupported characters");

export const mailboxSyncEventTypeSchema = z.enum(["upsert", "state", "tombstone"]);
export type MailboxSyncEventType = z.infer<typeof mailboxSyncEventTypeSchema>;

export const mailboxMessageStateSchema = z
  .object({
    unread: z.boolean().optional(),
    starred: z.boolean().optional(),
    folder: z.string().min(1).max(64).optional(),
  })
  .strict();
export type MailboxMessageState = z.infer<typeof mailboxMessageStateSchema>;

export const mailboxSyncEventSchema = z
  .object({
    seq: z.number().int().positive(),
    type: mailboxSyncEventTypeSchema,
    messageId: hash32Schema,
    occurredAt: z.string().datetime(),
    recipient: stellarAddressSchema,
    sender: stellarAddressSchema.optional(),
    /** Encrypted payload only. Never plaintext. */
    ciphertext: z.string().min(1).optional(),
    /** Content-addressed object-store key when the body was durably staged. */
    objectKey: z.string().min(1).optional(),
    state: mailboxMessageStateSchema.optional(),
    reason: z.enum(["deleted", "expired", "user"]).optional(),
  })
  .strict();
export type MailboxSyncEvent = z.infer<typeof mailboxSyncEventSchema>;

export const quarantineReasonSchema = z.enum([
  "invalid_payload_encoding",
  "malformed_envelope",
  "sender_mismatch",
  "recipient_mismatch",
  "expired_ttl",
  "empty_payload",
]);
export type QuarantineReason = z.infer<typeof quarantineReasonSchema>;

/**
 * Metadata retained for an invalid envelope. The original payload is discarded
 * at the quarantine boundary and must never be persisted or returned.
 */
export const quarantineRecordSchema = z
  .object({
    messageId: hash32Schema,
    recipient: stellarAddressSchema,
    reason: quarantineReasonSchema,
    receivedAt: z.string().datetime(),
  })
  .strict();
export type QuarantineRecord = z.infer<typeof quarantineRecordSchema>;

export const mailboxCheckpointSchema = z
  .object({
    owner: stellarAddressSchema,
    deviceId: deviceIdSchema,
    seq: z.number().int().nonnegative(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type MailboxCheckpoint = z.infer<typeof mailboxCheckpointSchema>;

export const mailboxSyncModeSchema = z.enum(["initial", "delta"]);
export type MailboxSyncMode = z.infer<typeof mailboxSyncModeSchema>;

export const mailboxSyncRequestSchema = z
  .object({
    deviceId: deviceIdSchema,
    cursor: z.string().min(1).max(4096).optional(),
    limit: z.number().int().min(1).max(MAX_SYNC_PAGE_SIZE).optional(),
  })
  .strict();
export type MailboxSyncRequest = z.infer<typeof mailboxSyncRequestSchema>;

export interface MailboxSyncResult {
  mode: MailboxSyncMode;
  events: MailboxSyncEvent[];
  cursor: string;
  hasMore: boolean;
}

export type AppendEventInput = Omit<MailboxSyncEvent, "seq">;
