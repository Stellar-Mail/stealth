import type { CanonicalUsername } from "./username";

/**
 * Stealth-address / Stellar-federation mapping (Issue #1910 / BETA-003).
 *
 * A reserved canonical username has two public-facing forms:
 * - `username@stealth.me` — the human-facing Stealth address shown in the
 *   product (mail-style, matches the onboarding story).
 * - `username*stealth.me` — the SEP-2 Stellar federation address, resolved
 *   by a `/federation?q=...&type=name` lookup (see
 *   https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0002.md).
 *   Building the actual public federation HTTP resolver endpoint is tracked
 *   separately (BETA-026); this module only defines the deterministic
 *   mapping so every reservation carries both forms from the start.
 */
export const STEALTH_FEDERATION_DOMAIN = "stealth.me";

export function toStealthAddress(canonicalUsername: CanonicalUsername): string {
  return `${canonicalUsername}@${STEALTH_FEDERATION_DOMAIN}`;
}

export function toFederationAddress(canonicalUsername: CanonicalUsername): string {
  return `${canonicalUsername}*${STEALTH_FEDERATION_DOMAIN}`;
}
