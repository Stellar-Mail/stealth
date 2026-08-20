import { z } from "zod";

import type {
  ChainMailboxPolicy,
  OnboardingDraftProjection,
  OnboardingDraftRecord,
  User,
} from "./domain";
import { ApiError } from "./errors";
import { getMailboxPolicy, setMailboxPolicy } from "./policy-service";
import type { ApiRepository } from "./repository";
import { draftToBetaDefaults, draftToMailboxPolicy } from "@/features/onboarding/types";
import { parseSessionCookie } from "./auth/session-service";

// ---------------------------------------------------------------------------
// BETA-013 (Issue #1920) — profile-first account onboarding.
//
// Onboarding is account-based and wallet-free:
// - The account is resolved from the server session (never from a
//   client-supplied wallet address).
// - The durable draft is keyed by userId, so a refresh or a second device
//   resumes from the same authoritative record and duplicate saves can
//   never create duplicates.
// - Completion converts the draft through the existing policy-conversion
//   functions (single source of truth, covered by tests) and writes the
//   mailbox policy through the existing idempotent policy path. No wallet
//   extension is involved anywhere in the flow.
// ---------------------------------------------------------------------------

export const onboardingStepSchema = z.enum([
  "profile",
  "stealth-address",
  "recovery",
  "sender-policy",
  "postage",
  "receipts",
  "review",
]);

export type OnboardingStep = z.infer<typeof onboardingStepSchema>;

/** Strict: any unknown key (e.g. `walletAddress`) fails validation with 422. */
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

export const onboardingDraftSaveSchema = z
  .object({
    step: onboardingStepSchema,
    draft: onboardingDraftFieldsSchema,
  })
  .strict();

export const onboardingCompleteSchema = z
  .object({
    draft: onboardingDraftFieldsSchema,
  })
  .strict();

export type OnboardingDraftFields = z.infer<typeof onboardingDraftFieldsSchema>;

/** Safe projection: never contains secrets, hashes, or wallet material. */
export function toOnboardingProjection(record: OnboardingDraftRecord): OnboardingDraftProjection {
  return {
    status: record.status,
    step: record.step,
    displayName: record.displayName,
    recoveryAcknowledged: record.recoveryAcknowledged,
    unknownSenderRule: record.unknownSenderRule,
    minimumPostage: record.minimumPostage,
    receiptOnDelivery: record.receiptOnDelivery,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt,
  };
}

/**
 * Resolves the authenticated account from the session cookie — the only
 * identity source for onboarding. Mirrors the bootstrap endpoint: session
 * cookie -> session record -> user record. A missing or stale session is
 * always 401; the identity is never derived from client input.
 */
export async function resolveSessionUser(
  repository: ApiRepository,
  cookieHeader: string | null | undefined,
): Promise<User> {
  const sessionId = parseSessionCookie(cookieHeader);
  if (!sessionId) {
    throw new ApiError(401, "unauthorized", "No active session cookie found");
  }

  const sessionRecord = await repository.getSession(sessionId);
  if (!sessionRecord) {
    throw new ApiError(401, "unauthorized", "Session is invalid or expired");
  }

  const userRecord = await repository.getUserById(sessionRecord.userId);
  if (!userRecord) {
    throw new ApiError(401, "unauthorized", "Associated user account not found");
  }

  return userRecord;
}

export async function getOnboardingDraft(
  repository: ApiRepository,
  userId: string,
): Promise<OnboardingDraftProjection | null> {
  const record = await repository.getOnboardingDraft(userId);
  return record ? toOnboardingProjection(record) : null;
}

/**
 * Upserts the in-progress onboarding draft. A completed onboarding can never
 * be resurrected into an in-progress flow (409): completion is terminal, and
 * re-runs of the flow must fail closed instead of rewriting a finished state.
 */
export async function saveOnboardingDraft(
  repository: ApiRepository,
  userId: string,
  input: { step: z.infer<typeof onboardingStepSchema>; draft: OnboardingDraftFields },
  now: Date = new Date(),
): Promise<OnboardingDraftProjection> {
  const existing = await repository.getOnboardingDraft(userId);
  if (existing?.status === "completed") {
    throw new ApiError(409, "invalid_state_transition", "Onboarding is already complete");
  }

  const record: OnboardingDraftRecord = {
    userId,
    status: "in_progress",
    step: input.step,
    displayName: input.draft.displayName,
    recoveryAcknowledged: input.draft.recoveryAcknowledged,
    unknownSenderRule: input.draft.unknownSenderRule,
    minimumPostage: input.draft.minimumPostage,
    receiptOnDelivery: input.draft.receiptOnDelivery,
    updatedAt: now.toISOString(),
    completedAt: null,
    version: (existing?.version ?? 0) + 1,
  };

  const saved = await repository.saveOnboardingDraft(record);
  return toOnboardingProjection(saved);
}

export interface CompleteOnboardingResult {
  /** True when this invocation replayed an already-completed onboarding. */
  alreadyCompleted: boolean;
  draft: OnboardingDraftProjection;
  policy: ChainMailboxPolicy;
}

/**
 * Terminal completion of onboarding. Idempotent:
 * - A completed record is replayed (never re-written, never re-activated).
 * - The chosen policy is converted with the preserved conversion functions
 *   and written only when the user still holds the provisioning default, so
 *   a replay can never clobber a policy the user changed after onboarding.
 * - The policy write itself is idempotent: `schedulePolicyWrite` treats
 *   re-scheduling the same policy as a no-op (never bumps the version).
 */
export async function completeOnboarding(
  repository: ApiRepository,
  user: User,
  input: OnboardingDraftFields,
  now: Date = new Date(),
): Promise<CompleteOnboardingResult> {
  if (user.status !== "active") {
    throw new ApiError(
      409,
      "invalid_state_transition",
      `Account status "${user.status}" cannot complete onboarding`,
    );
  }

  const existing = await repository.getOnboardingDraft(user.userId);
  if (existing?.status === "completed") {
    const policy = draftToBetaDefaults({
      displayName: existing.displayName,
      recoveryAcknowledged: existing.recoveryAcknowledged,
      unknownSenderRule: existing.unknownSenderRule,
      minimumPostage: existing.minimumPostage,
      receiptOnDelivery: existing.receiptOnDelivery,
    });
    return {
      alreadyCompleted: true,
      draft: toOnboardingProjection(existing),
      policy,
    };
  }

  // Never overwrite a policy that was configured after provisioning — the
  // "write the chosen policy" step applies only to the provisioning default.
  const current = await getMailboxPolicy(repository, user.address);
  if (current.source === "default") {
    await setMailboxPolicy(repository, user.address, draftToMailboxPolicy(input), {
      requireReceipt: input.receiptOnDelivery,
    });
  }

  const record: OnboardingDraftRecord = {
    userId: user.userId,
    status: "completed",
    step: "review",
    displayName: input.displayName,
    recoveryAcknowledged: input.recoveryAcknowledged,
    unknownSenderRule: input.unknownSenderRule,
    minimumPostage: input.minimumPostage,
    receiptOnDelivery: input.receiptOnDelivery,
    updatedAt: now.toISOString(),
    completedAt: now.toISOString(),
    version: (existing?.version ?? 0) + 1,
  };

  const saved = await repository.saveOnboardingDraft(record);
  return {
    alreadyCompleted: false,
    draft: toOnboardingProjection(saved),
    policy: draftToBetaDefaults(input),
  };
}
