/**
 * Relay persistence boundary (Issue #1935 BETA-028 / Issue #1943 BETA-036).
 *
 * The receiving relay service is decoupled from any concrete storage adapter.
 * This interface is the single storage contract the relay domain depends on:
 * memory, Cloudflare KV, and future durable adapters all implement it. Health
 * and readiness probes only ever read aggregate, non-sensitive counters.
 *
 * Admission records are stored separately from queued payloads so a blocked
 * decision can be replayed idempotently without ever writing ciphertext.
 */

import type { AdmissionEvidence } from "@/server/api/domain";

export interface RelayEnvelope {
  /** Immutable 32-byte lowercase hex message identifier. */
  messageId: string;
  /** Stellar G-address of the sender. */
  sender: string;
  /** Stellar G-address of the recipient. */
  recipient: string;
  /** Public destination domain of the recipient's relay. */
  recipientDomain: string;
  /** Opaque encrypted message payload. Never parsed or logged. */
  payload: string;
  /** Delivery TTL in milliseconds. */
  ttlMs: number;
  /** Server-side acceptance timestamp (ISO-8601). */
  receivedAt: string;
  /** Snapshotted policy decision. Set on every live admission. */
  admission?: AdmissionEvidence;
  /** Object-store key when the payload was staged to R2. */
  payloadKey?: string;
}

export interface RelayAdmissionRecord {
  messageId: string;
  sender: string;
  recipient: string;
  admission: AdmissionEvidence;
  payloadStored: boolean;
  payloadKey?: string;
  recordedAt: string;
}

export interface RecordAdmissionResult {
  record: RelayAdmissionRecord;
  duplicate: boolean;
}

export interface RelayPersistence {
  /**
   * Storage liveness probe. Resolves when the adapter can serve reads/writes
   * and rejects when storage is unavailable.
   */
  ping(): Promise<void>;

  /** Number of messages currently queued for delivery. */
  getQueueDepth(): Promise<number>;

  /** Number of delivery retries recorded against this relay. */
  getRetryCount(): Promise<number>;

  /** Number of permanently failed (dead-lettered) deliveries. */
  getDeadLetterCount(): Promise<number>;

  /** First-write-wins admission snapshot. Retries return the original record. */
  getAdmission(messageId: string): Promise<RelayAdmissionRecord | null>;

  recordAdmission(record: RelayAdmissionRecord): Promise<RecordAdmissionResult>;

  /** Durably accept a message into the relay queue. Idempotent on messageId. */
  enqueue(envelope: RelayEnvelope): Promise<{ messageId: string }>;

  /** Remove and return the next queued message, or null when empty. */
  dequeue(): Promise<RelayEnvelope | null>;

  /** Record one transient delivery failure for observability. */
  recordRetry(): Promise<void>;

  /** Record one permanent delivery failure for observability. */
  recordDeadLetter(): Promise<void>;

  /** Query envelopes in the relay queue for a specific recipient. */
  listRecipientQueue(recipient: string): Promise<RelayEnvelope[]>;
}
