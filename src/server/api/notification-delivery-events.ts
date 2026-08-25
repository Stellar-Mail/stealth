import { z } from "zod";

import { loadRuntimeConfig } from "@/config";
import { constantTimeCompare } from "@/server/api/auth/password";
import { ApiError } from "@/server/api/errors";
import {
  defaultVerificationMailQueue,
  type DeliveryRecord,
  type ProviderBounceEvent,
  type VerificationMailQueue,
} from "@/services/notifications/queue";
import { redactNotificationText } from "@/services/notifications/redaction";

/**
 * BETA-091: Provider-neutral delivery-event ingestion (DSN / bounce / complaint).
 * Authenticated with STEALTH_OPERATOR_SECRET. Never echoes raw mailbox text or tokens.
 */

export const deliveryEventTypeSchema = z.enum([
  "delivered",
  "deferred",
  "soft_bounce",
  "hard_bounce",
  "rejected",
  "complaint",
  "unsubscribed",
]);

export const deliveryEventIngestSchema = z.object({
  messageId: z.string().trim().min(1).max(200),
  eventType: deliveryEventTypeSchema,
  providerEventId: z.string().trim().min(1).max(200).optional(),
  /** Free-form provider text — redacted before persistence. */
  reason: z.string().max(500).optional(),
  occurredAt: z.string().datetime().optional(),
});

export type DeliveryEventIngestInput = z.infer<typeof deliveryEventIngestSchema>;

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

export async function assertDeliveryEventOperator(request: Request): Promise<void> {
  const provided = extractBearerToken(request);
  let expected: string | undefined;

  if (import.meta.env.PROD) {
    try {
      const { env } = await import("cloudflare:workers");
      expected = (env as Record<string, string | undefined>).STEALTH_OPERATOR_SECRET;
    } catch {
      expected = undefined;
    }
  } else {
    expected = loadRuntimeConfig().secrets?.operatorSecret;
  }

  if (!expected || !provided || !constantTimeCompare(provided, expected)) {
    throw new ApiError(401, "unauthorized", "Operator authentication required");
  }
}

export function ingestDeliveryEvent(
  input: DeliveryEventIngestInput,
  queue: VerificationMailQueue = defaultVerificationMailQueue,
): { found: boolean; record?: DeliveryRecord } {
  const event: ProviderBounceEvent = {
    messageId: input.messageId,
    eventType: input.eventType,
    providerEventId: input.providerEventId,
    rawReason: input.reason ? redactNotificationText(input.reason) : undefined,
    occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
  };

  const record = queue.applyProviderEvent(event);
  if (!record) {
    return { found: false };
  }
  return { found: true, record };
}

/** Redacted public view of a delivery record for API responses. */
export function toPublicDeliveryEventRecord(record: DeliveryRecord) {
  return {
    messageId: record.messageId,
    purpose: record.purpose,
    recipientDomain: record.recipientDomain,
    recipientHash: record.recipientHash,
    state: record.state,
    reasonClass: record.reasonClass,
    providerEventId: record.providerEventId,
    attempts: record.attempts,
    updatedAt: record.updatedAt,
    deadLetteredAt: record.deadLetteredAt,
  };
}
