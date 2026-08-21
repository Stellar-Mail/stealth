import type { UnknownSenderPolicy } from "@/features/preferences";
import type { ChainMailboxPolicy, MailboxPolicy } from "@/server/api/domain";

export type OnboardingStep =
  | "profile"
  | "stealth-address"
  | "recovery"
  | "sender-policy"
  | "postage"
  | "receipts"
  | "review";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "profile",
  "stealth-address",
  "recovery",
  "sender-policy",
  "postage",
  "receipts",
  "review",
];

/**
 * Data accumulated across all onboarding steps.
 * Persisted to the server by userId (resumable across refreshes and devices).
 * Identity is the authenticated account — no client-supplied wallet address.
 */
export type OnboardingDraft = {
  displayName: string;
  recoveryAcknowledged: boolean;
  unknownSenderRule: UnknownSenderPolicy;
  minimumPostage: string; // XLM decimal string, e.g. "0.0001"
  receiptOnDelivery: boolean;
};

export const DEFAULT_DRAFT: OnboardingDraft = {
  displayName: "",
  recoveryAcknowledged: false,
  // Privacy-preserving default: hold unknown senders for review rather than auto-blocking
  unknownSenderRule: "request",
  minimumPostage: "0",
  receiptOnDelivery: false,
};

/**
 * Maps the UI sender rule enum to protocol-level mailbox policy booleans.
 * Kept here so useOnboarding and tests can share it without importing from server code.
 */
export const SENDER_RULE_TO_POLICY: Record<
  UnknownSenderPolicy,
  Pick<MailboxPolicy, "allowUnknown" | "requireVerified">
> = {
  request: { allowUnknown: true, requireVerified: false },
  verified: { allowUnknown: true, requireVerified: true },
  block: { allowUnknown: false, requireVerified: false },
};

/**
 * Convert an XLM decimal string to a Soroban-compatible stroop integer string.
 * Returns "0" for any invalid or negative input — callers must validate before submission.
 */
export function xlmToStroops(xlm: string): string {
  const amount = parseFloat(xlm);
  if (!isFinite(amount) || amount < 0) return "0";
  return String(Math.round(amount * 10_000_000));
}

/**
 * Build a MailboxPolicy from the completed onboarding draft.
 * Minimumpostage is converted from XLM to stroops here.
 */
export function draftToMailboxPolicy(draft: OnboardingDraft): MailboxPolicy {
  return {
    ...SENDER_RULE_TO_POLICY[draft.unknownSenderRule],
    minimumPostage: xlmToStroops(draft.minimumPostage),
  };
}

/**
 * Build the full on-chain mailbox policy for the completed onboarding draft,
 * including the delivery-receipt preference. This is the privacy-safe beta
 * default that provisioning schedules for the testnet contract write, and it
 * matches the beta default's "request unknown senders, zero minimum postage,
 * no forced receipts" starting point when the user accepts every default.
 */
export function draftToBetaDefaults(draft: OnboardingDraft): ChainMailboxPolicy {
  return {
    ...SENDER_RULE_TO_POLICY[draft.unknownSenderRule],
    minimumPostage: xlmToStroops(draft.minimumPostage),
    requireReceipt: draft.receiptOnDelivery,
  };
}
