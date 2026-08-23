import { z } from "zod";

import type { OnboardingDraft } from "./types";

// ---------------------------------------------------------------------------
// BETA-013 (Issue #1920) — server-backed onboarding client API.
//
// All draft state lives on the server (keyed by the session account), so a
// refresh or a second device resumes from the same authoritative record. The
// request schemas are strict: any unknown field (e.g. a wallet address) is
// rejected with a 422 validation error rather than silently stored.
// ---------------------------------------------------------------------------

export const onboardingDraftFieldsSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, "Display name cannot be empty")
      .max(80, "Display name cannot exceed 80 characters"),
    recoveryAcknowledged: z.boolean(),
    unknownSenderRule: z.enum(["request", "verified", "block"]),
    minimumPostage: z.string().regex(/^\d*\.?\d{0,7}$/, "Expected a non-negative XLM amount"),
    receiptOnDelivery: z.boolean(),
  })
  .strict();

export const onboardingDraftSaveRequestSchema = z
  .object({
    step: z.enum([
      "profile",
      "stealth-address",
      "recovery",
      "sender-policy",
      "postage",
      "receipts",
      "review",
    ]),
    draft: onboardingDraftFieldsSchema,
  })
  .strict();

export const onboardingDraftProjectionSchema = z.object({
  status: z.enum(["in_progress", "completed"]),
  step: onboardingDraftSaveRequestSchema.shape.step,
  displayName: z.string(),
  recoveryAcknowledged: z.boolean(),
  unknownSenderRule: z.enum(["request", "verified", "block"]),
  minimumPostage: z.string(),
  receiptOnDelivery: z.boolean(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
});

export const onboardingCompleteResultSchema = z.object({
  alreadyCompleted: z.boolean(),
  draft: onboardingDraftProjectionSchema,
  policy: z.object({
    allowUnknown: z.boolean(),
    requireVerified: z.boolean(),
    requireReceipt: z.boolean(),
    minimumPostage: z.string(),
  }),
});

export type OnboardingDraftProjection = z.infer<typeof onboardingDraftProjectionSchema>;
export type OnboardingCompleteResult = z.infer<typeof onboardingCompleteResultSchema>;

const API_BASE = "/api/v1/onboarding";

async function unpackData<D>(response: Response, schema: z.ZodType<D>): Promise<D> {
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      if (payload?.error?.message) message = payload.error.message;
    } catch {
      // Keep the generic message when the body is not JSON
    }
    const error = new Error(message);
    (error as Error & { cause?: number }).cause = response.status;
    throw error;
  }
  const envelope = z.object({ data: z.unknown() }).parse(await response.json().catch(() => null));
  return schema.parse(envelope.data);
}

/** Reads the durable server-backed draft for the session account. */
export async function fetchOnboardingDraft(): Promise<OnboardingDraftProjection | null> {
  const response = await fetch(`${API_BASE}/draft`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const payload = await unpackData(
    response,
    z.object({ draft: onboardingDraftProjectionSchema.nullable() }),
  );
  return payload.draft;
}

/** Upserts the durable draft. Duplicate saves can never create duplicates. */
export async function saveOnboardingDraft(
  step: OnboardingDraftProjection["step"],
  draft: OnboardingDraft,
): Promise<OnboardingDraftProjection> {
  const response = await fetch(`${API_BASE}/draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(onboardingDraftSaveRequestSchema.parse({ step, draft })),
  });
  const payload = await unpackData(response, onboardingDraftProjectionSchema);
  return payload;
}

/**
 * Terminally completes onboarding. `idempotencyKey` is stable across retries
 * of the same payload so a network timeout can never double-apply completion.
 */
export async function completeOnboarding(
  draft: OnboardingDraft,
  idempotencyKey: string,
): Promise<OnboardingCompleteResult> {
  const response = await fetch(`${API_BASE}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({
      draft: onboardingDraftFieldsSchema.parse(draft),
    }),
  });
  const payload = await unpackData(response, onboardingCompleteResultSchema);
  return payload;
}
