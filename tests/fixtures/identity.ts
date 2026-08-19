import { Keypair } from "@stellar/stellar-sdk";
import type { RegistrationRequest } from "@/features/identity/registration";
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@/features/identity/registration";
import type { MailboxPolicy } from "@/server/api/domain";

/**
 * Isolated test fixture for Alice.
 */
export const ALICE_FIXTURE: RegistrationRequest = {
  displayName: "Alice Smith",
  email: "alice@stealth.mail",
  username: "alice_smith",
  password: "Password123!a",
  passwordConfirmation: "Password123!a",
  termsVersion: CURRENT_TERMS_VERSION,
  privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
};

/**
 * Isolated test fixture for Bob.
 */
export const BOB_FIXTURE: RegistrationRequest = {
  displayName: "Bob Jones",
  email: "bob@stealth.mail",
  username: "bob_jones",
  password: "Password123!b",
  passwordConfirmation: "Password123!b",
  termsVersion: CURRENT_TERMS_VERSION,
  privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
};

/**
 * Default privacy-safe mailbox policy expected upon onboarding / provisioning.
 */
export const EXPECTED_BETA_DEFAULT_POLICY: MailboxPolicy = {
  allowUnknown: true,
  requireVerified: false,
  minimumPostage: "0",
};

/**
 * Patterns matching sensitive secrets that must be redacted from all logs,
 * failure artifacts, traces, and screenshots.
 */
export const SENSITIVE_PATTERNS = [
  /Password123![ab]?/gi,
  /S[A-Z2-7]{55}/g, // Stellar private secret keys
  /stealth_session=[a-zA-Z0-9_.-]+/g,
  /sess_[a-zA-Z0-9_.-]+/g,
  /secretHash/gi,
  /walletKeyRef/gi,
];

/**
 * Redacts secrets from strings, objects, and nested structures.
 */
export function redactSecrets<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === "string") {
    let str: string = input;
    str = str.replace(/Password123![ab]?/gi, "[REDACTED_PASSWORD]");
    str = str.replace(/S[A-Z2-7]{55}/g, "[REDACTED_STELLAR_SECRET]");
    str = str.replace(/stealth_session=[^;\s]+/g, "stealth_session=[REDACTED_TOKEN]");
    return str as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactSecrets(item)) as unknown as T;
  }

  if (typeof input === "object") {
    const redactedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("pass") ||
        lowerKey.includes("secrethash") ||
        lowerKey.includes("walletkeyref") ||
        lowerKey.includes("secretkey") ||
        lowerKey.includes("privatekey")
      ) {
        redactedObj[key] = "[REDACTED_SECRET]";
      } else {
        redactedObj[key] = redactSecrets(value);
      }
    }
    return redactedObj as unknown as T;
  }

  return input;
}

/**
 * Asserts that no sensitive secrets (passwords, private keys, hashes) leak in
 * the provided text or serialized object.
 */
export function assertNoSecretsLeaked(target: unknown): void {
  const serialized = typeof target === "string" ? target : JSON.stringify(target);
  if (!serialized) return;

  if (/Password123![ab]?/i.test(serialized)) {
    throw new Error("Security assertion failure: Raw password detected in output");
  }

  // Check for Stellar secret key format (56 uppercase chars starting with 'S')
  const secretKeyMatch = serialized.match(/\bS[A-Z2-7]{55}\b/);
  if (secretKeyMatch) {
    throw new Error("Security assertion failure: Stellar secret key detected in output");
  }
}

/**
 * Failure artifact capture container with automatic redaction.
 */
export interface FailureArtifact {
  testName: string;
  timestamp: string;
  sanitizedContext: Record<string, unknown>;
  errorMessage: string;
}

export function captureRedactedFailureArtifact(
  testName: string,
  error: unknown,
  context: Record<string, unknown> = {},
): FailureArtifact {
  const rawMessage = error instanceof Error ? error.message : String(error);
  return {
    testName,
    timestamp: new Date().toISOString(),
    sanitizedContext: redactSecrets(context) as Record<string, unknown>,
    errorMessage: redactSecrets(rawMessage),
  };
}

/**
 * Opt-in helper to check if live testnet mode is active.
 */
export function isLiveTestnetMode(): boolean {
  return (
    process.env.STEALTH_TESTNET_LIVE === "true" ||
    process.env.LIVE_TESTNET === "true" ||
    process.env.STEALTH_NETWORK === "testnet-live"
  );
}

/**
 * Creates a deterministic or live testnet Stellar keypair.
 */
export function createTestKeypair(seedChar?: string): {
  publicKey: string;
  secretKey: string;
} {
  if (isLiveTestnetMode()) {
    const pair = Keypair.random();
    return {
      publicKey: pair.publicKey(),
      secretKey: pair.secret(),
    };
  }

  if (seedChar) {
    const pub = `G${seedChar.repeat(55)}`;
    const sec = `S${seedChar.repeat(55)}`;
    return { publicKey: pub, secretKey: sec };
  }

  const randomPair = Keypair.random();
  return {
    publicKey: randomPair.publicKey(),
    secretKey: randomPair.secret(),
  };
}
