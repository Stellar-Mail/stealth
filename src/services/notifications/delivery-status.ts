/**
 * BETA-091: Verification-delivery lifecycle states.
 *
 * Provider HTTP 202 / SMTP 250 acceptance is not the same as mailbox delivery.
 * Operators observe distinct states so bounce, deferral, and complaint handling
 * stay separate from "queued/accepted".
 */

export const DELIVERY_STATES = [
  "queued",
  "accepted",
  "sent",
  "delivered",
  "deferred",
  "soft_bounce",
  "hard_bounce",
  "rejected",
  "complaint",
  "unsubscribed",
  "failed",
] as const;

export type DeliveryState = (typeof DELIVERY_STATES)[number];

/** Reason classes safe to persist/log — never include token or full recipient. */
export const DELIVERY_REASON_CLASSES = [
  "accepted_by_mta",
  "transient_network",
  "transient_mailbox",
  "rate_limited",
  "permanent_reject",
  "hard_bounce",
  "soft_bounce",
  "complaint",
  "unsubscribed",
  "expired",
  "poison_payload",
  "unknown",
] as const;

export type DeliveryReasonClass = (typeof DELIVERY_REASON_CLASSES)[number];

const TERMINAL_STATES: ReadonlySet<DeliveryState> = new Set([
  "delivered",
  "hard_bounce",
  "rejected",
  "complaint",
  "unsubscribed",
  "failed",
]);

const ALLOWED_TRANSITIONS: Record<DeliveryState, ReadonlySet<DeliveryState>> = {
  queued: new Set([
    "accepted",
    "sent",
    "deferred",
    "soft_bounce",
    "hard_bounce",
    "rejected",
    "failed",
  ]),
  accepted: new Set(["sent", "deferred", "soft_bounce", "hard_bounce", "rejected", "failed"]),
  sent: new Set([
    "delivered",
    "deferred",
    "soft_bounce",
    "hard_bounce",
    "rejected",
    "complaint",
    "unsubscribed",
    "failed",
  ]),
  delivered: new Set(["complaint", "unsubscribed"]),
  deferred: new Set([
    "queued",
    "sent",
    "delivered",
    "soft_bounce",
    "hard_bounce",
    "rejected",
    "failed",
  ]),
  soft_bounce: new Set(["queued", "sent", "delivered", "hard_bounce", "failed"]),
  hard_bounce: new Set(),
  rejected: new Set(),
  complaint: new Set(),
  unsubscribed: new Set(),
  failed: new Set(["queued"]),
};

export function isTerminalDeliveryState(state: DeliveryState): boolean {
  return TERMINAL_STATES.has(state);
}

/** States that may still need a send callback for backoff retries. */
export function shouldRetainSendCallback(state: DeliveryState): boolean {
  return state === "queued" || state === "deferred" || state === "soft_bounce";
}

export function canTransitionDeliveryState(from: DeliveryState, to: DeliveryState): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.has(to) ?? false;
}

/**
 * Classifies SMTP reply codes into retryable vs permanent failure classes.
 * Only the numeric class is retained — never the full reply text (may echo RCPT).
 */
export function classifySmtpReplyCode(code: number): {
  state: DeliveryState;
  reasonClass: DeliveryReasonClass;
  retryable: boolean;
} {
  if (code >= 200 && code < 300) {
    return { state: "accepted", reasonClass: "accepted_by_mta", retryable: false };
  }
  if (code === 421 || code === 450 || code === 451 || code === 452 || (code >= 400 && code < 500)) {
    return { state: "deferred", reasonClass: "transient_mailbox", retryable: true };
  }
  if (code === 550 || code === 551 || code === 552 || code === 553 || code === 554) {
    return { state: "hard_bounce", reasonClass: "hard_bounce", retryable: false };
  }
  if (code >= 500 && code < 600) {
    return { state: "rejected", reasonClass: "permanent_reject", retryable: false };
  }
  return { state: "failed", reasonClass: "unknown", retryable: true };
}
