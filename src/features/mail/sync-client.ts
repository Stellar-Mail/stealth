/**
 * HTTP client for POST /api/v1/mailbox/sync (Issue #1941 BETA-034).
 */
import { MailboxSyncError, type MailboxSyncResult } from "./types";

export interface FetchMailboxSyncInput {
  actor: string;
  deviceId: string;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export async function fetchMailboxSync(input: FetchMailboxSyncInput): Promise<MailboxSyncResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl("/api/v1/mailbox/sync", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-stealth-address": input.actor,
    },
    body: JSON.stringify({
      deviceId: input.deviceId,
      ...(input.cursor ? { cursor: input.cursor } : {}),
      ...(input.limit ? { limit: input.limit } : {}),
    }),
    signal: input.signal,
  });

  const body = (await response.json()) as {
    data?: MailboxSyncResult;
    error?: { code?: string; message?: string; retryable?: boolean };
  };

  if (!response.ok) {
    throw new MailboxSyncError(
      response.status,
      body.error?.code ?? "internal_error",
      body.error?.message ?? "Mailbox sync failed",
      Boolean(body.error?.retryable) || response.status >= 500 || response.status === 429,
    );
  }

  if (!body.data || !Array.isArray(body.data.events) || typeof body.data.cursor !== "string") {
    throw new MailboxSyncError(500, "internal_error", "Malformed mailbox sync response", true);
  }

  return body.data;
}
