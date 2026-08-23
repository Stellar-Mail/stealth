/**
 * Recipient mailbox ingestion (Issue #1941 BETA-034).
 *
 * Drains relay-queue envelopes into the mailbox event log exactly once.
 * Invalid envelopes are quarantined as reason-only records; the rejected
 * payload is discarded and never appears in a sync response.
 */
import { z } from "zod";

import { hash32Schema, stellarAddressSchema } from "@/server/api/domain";
import type { RelayObjectStore } from "./object-store";
import type { RelayEnvelope } from "./persistence";
import type { MailboxSyncPersistence } from "./mailbox-sync-persistence";
import type { QuarantineReason } from "./mailbox-sync-types";

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

const sealedEnvelopeShapeSchema = z
  .object({
    ciphertext: z.string().min(1).optional(),
    payload: z
      .object({
        version: z.string().min(1),
        sender: stellarAddressSchema,
        recipient: stellarAddressSchema,
        timestamp: z.string().min(1),
        content_commitment: hash32Schema.optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type IngestOutcome =
  | { status: "delivered"; messageId: string; seq: number; created: boolean; objectKey?: string }
  | { status: "quarantined"; messageId: string; reason: QuarantineReason; created: boolean }
  | { status: "skipped"; messageId: string; reason: "already_quarantined" };

export interface IngestMailboxEnvelopeOptions {
  now?: () => Date;
  objectStore?: RelayObjectStore;
}

function bytesFromBase64(value: string): Uint8Array | null {
  if (!value || !BASE64_PATTERN.test(value) || value.length % 4 !== 0) {
    return null;
  }
  try {
    const buffer = Buffer.from(value, "base64");
    return buffer.length > 0 ? new Uint8Array(buffer) : null;
  } catch {
    return null;
  }
}

function utf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function validateInnerEnvelope(envelope: RelayEnvelope, decoded: unknown): QuarantineReason | null {
  const parsed = sealedEnvelopeShapeSchema.safeParse(decoded);
  if (!parsed.success) {
    return "malformed_envelope";
  }
  const inner = parsed.data.payload;
  if (!inner) {
    return parsed.data.ciphertext ? null : "malformed_envelope";
  }
  if (inner.sender !== envelope.sender) return "sender_mismatch";
  if (inner.recipient !== envelope.recipient) return "recipient_mismatch";
  return null;
}

export function classifyRelayEnvelope(
  envelope: RelayEnvelope,
  now: Date = new Date(),
): { ok: true; bytes: Uint8Array } | { ok: false; reason: QuarantineReason } {
  if (!envelope.payload) {
    return { ok: false, reason: "empty_payload" };
  }

  const receivedAt = Date.parse(envelope.receivedAt);
  if (Number.isFinite(receivedAt) && receivedAt + envelope.ttlMs <= now.getTime()) {
    return { ok: false, reason: "expired_ttl" };
  }

  const bytes = bytesFromBase64(envelope.payload);
  if (!bytes || bytes.length === 0) {
    return { ok: false, reason: "invalid_payload_encoding" };
  }

  const asText = utf8(bytes).trim();
  if (asText.startsWith("{")) {
    try {
      const decoded = JSON.parse(asText) as unknown;
      const looksLikeEnvelope =
        decoded && typeof decoded === "object" && ("payload" in decoded || "ciphertext" in decoded);
      if (looksLikeEnvelope) {
        const reason = validateInnerEnvelope(envelope, decoded);
        if (reason) return { ok: false, reason };
      }
    } catch {
      return { ok: false, reason: "malformed_envelope" };
    }
  }

  return { ok: true, bytes };
}

export async function ingestMailboxEnvelope(
  persistence: MailboxSyncPersistence,
  envelope: RelayEnvelope,
  options: IngestMailboxEnvelopeOptions = {},
): Promise<IngestOutcome> {
  const now = options.now?.() ?? new Date();

  return persistence.withMessageLock(envelope.messageId, async () => {
    const quarantined = await persistence.getQuarantine(envelope.messageId);
    if (quarantined) {
      return {
        status: "skipped" as const,
        messageId: envelope.messageId,
        reason: "already_quarantined" as const,
      };
    }

    const classification = classifyRelayEnvelope(envelope, now);
    if (!classification.ok) {
      const result = await persistence.putQuarantine({
        messageId: envelope.messageId,
        recipient: envelope.recipient,
        reason: classification.reason,
        receivedAt: envelope.receivedAt,
      });
      return {
        status: "quarantined" as const,
        messageId: envelope.messageId,
        reason: classification.reason,
        created: result.created,
      };
    }

    let objectKey: string | undefined;
    if (options.objectStore) {
      objectKey = await options.objectStore.storeEnvelopeBody({
        messageId: envelope.messageId,
        ownerAddress: envelope.recipient,
        contentType: "application/octet-stream",
        bytes: classification.bytes,
      });
    }

    const appended = await persistence.appendEvent({
      type: "upsert",
      messageId: envelope.messageId,
      recipient: envelope.recipient,
      sender: envelope.sender,
      occurredAt: envelope.receivedAt,
      ciphertext: envelope.payload,
      ...(objectKey ? { objectKey } : {}),
    });

    return {
      status: "delivered" as const,
      messageId: envelope.messageId,
      seq: appended.event.seq,
      created: appended.created,
      ...(objectKey ? { objectKey } : {}),
    };
  });
}
