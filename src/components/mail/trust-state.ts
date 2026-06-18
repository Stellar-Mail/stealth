import type { Email } from "./data";
import { isVerified } from "./data";
import type { TrustState } from "@/features/design-system/components/trust-badge";

/**
 * Derive the sender-trust states for a message from its protocol metadata.
 * Centralizing this guarantees the same sender renders the same badges on
 * every surface. States are ordered by priority so compact surfaces can show
 * the most important one first.
 */
export function getTrustStates(email: Email): TrustState[] {
  const states: TrustState[] = [];
  const labels = new Set(email.labels ?? []);

  // Explicit user decision takes precedence.
  if (email.senderPolicy === "block") states.push("blocked");
  else if (email.senderPolicy === "allow") states.push("allowed");

  // Identity verification (folder-, flag-, or policy-derived).
  if (email.verifiedSender || isVerified(email) || email.senderPolicy === "verify") {
    states.push("verified");
  }

  // Protocol attributes can stack on top of the above.
  if (email.folder === "encrypted" || labels.has("Encrypted")) {
    states.push("encrypted");
  }
  if (labels.has("Bridge") || labels.has("Bridged")) states.push("bridged");
  if (labels.has("Paid") || Boolean(email.postageAmount)) states.push("paid");

  // Fallback when nothing else applies.
  if (states.length === 0) states.push("unknown");

  // De-duplicate while preserving priority order.
  return [...new Set(states)];
}

/** The single most important trust state, for compact surfaces. */
export function getPrimaryTrustState(email: Email): TrustState {
  return getTrustStates(email)[0];
}
