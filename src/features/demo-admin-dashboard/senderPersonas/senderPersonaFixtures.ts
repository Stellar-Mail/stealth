import type { SenderPersona } from "./types";

/**
 * Deterministic, fake sender personas safe for public review.
 * No real user data, secrets, or live network calls are used.
 */
export const defaultSenderPersonas: SenderPersona[] = [
  {
    id: "sp-trusted-1",
    name: "System Updates",
    email: "updates*stealth.demo",
    policy: "allow",
    isTrusted: true,
  },
  {
    id: "sp-external-1",
    name: "Alice Partner",
    email: "alice@example.com",
    policy: "none",
    isTrusted: false,
  },
  {
    id: "sp-blocked-1",
    name: "Spammy Sender",
    email: "deals@example.org",
    policy: "block",
    isTrusted: false,
  },
];
