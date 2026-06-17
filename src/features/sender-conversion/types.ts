import { BadgeCheck, Ban, ShieldCheck, type LucideIcon } from "lucide-react";
import type { Email, MailLocation, SenderPolicy } from "@/components/mail/data";
import type { FeedbackTone } from "@/features/design-system/feedback/use-feedback";

/**
 * The decision a user can make about a frequent unknown sender.
 * Mirrors the protocol-level per-sender rule (`allow` / `block`) plus an
 * intermediate `verify` step that keeps the sender but requires a verified
 * Stellar identity before their mail is trusted.
 */
export type SenderPolicyChoice = SenderPolicy;

/**
 * Minimal description of the sender being converted. Decoupled from `Email`
 * so any surface (request card, sender card, reader header) can open the flow
 * with just the fields it has.
 */
export type SenderConversionTarget = {
  emailId: string;
  sender: string;
  address: string;
  /** Current policy, if the sender was converted before (enables re-decisions). */
  currentPolicy?: SenderPolicyChoice;
};

/**
 * Static, presentational metadata for each choice. Lives in one place so the
 * dialog, the success state, and tests all read the same copy.
 */
export type SenderPolicyOption = {
  value: SenderPolicyChoice;
  label: string;
  /** One-line summary shown on the option card. */
  summary: string;
  /** The concrete difference — what actually happens to their mail. */
  effect: string;
  badge: string;
  icon: LucideIcon;
  tone: FeedbackTone;
};

export const SENDER_POLICY_OPTIONS: SenderPolicyOption[] = [
  {
    value: "allow",
    label: "Allow",
    summary: "Treat this sender as a trusted contact.",
    effect: "Future mail skips review and lands directly in your inbox. No postage required.",
    badge: "Trusted",
    icon: BadgeCheck,
    tone: "success",
  },
  {
    value: "verify",
    label: "Verify",
    summary: "Allow, but only with a verified Stellar identity.",
    effect:
      "Mail is accepted once the sender's cryptographic identity checks out, then filed under Verified.",
    badge: "Verified",
    icon: ShieldCheck,
    tone: "neutral",
  },
  {
    value: "block",
    label: "Block",
    summary: "Reject this sender and refund their postage.",
    effect: "Their messages are quarantined to Spam and they can no longer reach you.",
    badge: "Blocked",
    icon: Ban,
    tone: "danger",
  },
];

export function getSenderPolicyOption(choice: SenderPolicyChoice): SenderPolicyOption {
  const option = SENDER_POLICY_OPTIONS.find((item) => item.value === choice);
  // Exhaustive by construction; the fallback keeps callers null-safe.
  return option ?? SENDER_POLICY_OPTIONS[0];
}

/**
 * The outcome of a conversion: the email patch that moves the sender to its new
 * home plus a human-readable confirmation. Pure so it can be unit-tested and so
 * the route layer stays a thin applicator.
 */
export type SenderConversionResult = {
  choice: SenderPolicyChoice;
  patch: Partial<Email>;
  /** Destination folder, surfaced in the success state ("filed under …"). */
  folder: MailLocation;
  badge: string;
  toast: { message: string; tone: FeedbackTone };
};

/** Where each choice files the sender's current message. */
const CHOICE_FOLDER: Record<SenderPolicyChoice, MailLocation> = {
  allow: "inbox",
  verify: "verified",
  block: "spam",
};

/**
 * Resolve a choice into the concrete email mutation. Keeps the policy badge in
 * sync with folder placement and replaces any prior conversion label so a
 * sender re-decision doesn't accumulate stale badges.
 */
export function resolveSenderConversion(
  email: Pick<Email, "from" | "labels">,
  choice: SenderPolicyChoice,
): SenderConversionResult {
  const option = getSenderPolicyOption(choice);
  const folder = CHOICE_FOLDER[choice];
  const conversionLabels = new Set(SENDER_POLICY_OPTIONS.map((item) => item.badge));
  const labels = [
    ...(email.labels ?? []).filter((label) => !conversionLabels.has(label)),
    option.badge,
  ];

  const toastByChoice: Record<SenderPolicyChoice, string> = {
    allow: `${email.from} is now a trusted contact`,
    verify: `${email.from} will be accepted once their identity is verified`,
    block: `${email.from} blocked — postage marked for refund`,
  };

  return {
    choice,
    folder,
    badge: option.badge,
    patch: { folder, senderPolicy: choice, labels },
    toast: { message: toastByChoice[choice], tone: option.tone },
  };
}
