/**
 * Core policy levels for how a sender is treated in the demo.
 */
export type SenderPolicy = "allow" | "block" | "none";

/**
 * Represents a reusable sender persona configuration.
 * Used to populate demo inbox scenarios without relying on real user data.
 */
export interface SenderPersona {
  /** Unique identifier for the sender persona. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Safe demo address (must be example.com, example.org, or *.stealth.demo). */
  email: string;
  /** Optional deterministic avatar URL. */
  avatarUrl?: string;
  /** Policy designation simulating sender-conversion or spam logic. */
  policy: SenderPolicy;
  /** Simulated verification status. */
  isTrusted: boolean;
  /** Optional relay node URL. */
  relayNode?: string;
}
