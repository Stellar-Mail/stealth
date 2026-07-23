/**
 * Crypto capability descriptor for supported clients (#1709).
 *
 * The crypto module has no machine-readable way to report supported envelope
 * versions, algorithms, limits, or key formats. Clients cannot safely decide
 * whether they can exchange envelopes before attempting encryption.
 *
 * This module exposes a non-secret, immutable capability descriptor derived
 * from a single source of truth (the suite registry). It reveals no private
 * keys or environment secrets. Self-contained.
 */

/** A single supported algorithm suite entry. */
export interface SuiteCapability {
  name: string;
  keyBits: number;
  nonceBytes: number;
}

/** The single source of truth for supported crypto behavior. */
export const CRYPTO_SUITE_REGISTRY = {
  envelopeVersion: "v1",
  suites: [
    { name: "AES-256-GCM", keyBits: 256, nonceBytes: 12 },
    { name: "AES-128-GCM", keyBits: 128, nonceBytes: 12 },
  ] as SuiteCapability[],
  keyFormats: ["raw", "jwk"] as const,
  limits: {
    maxBodyBytes: 64 * 1024,
    maxAttachments: 16,
    maxAttachmentBytes: 16 * 1024 * 1024,
  },
} as const;

/** Non-secret, immutable description of what this client supports. */
export interface CryptoCapabilities {
  envelopeVersion: string;
  suites: ReadonlyArray<SuiteCapability>;
  keyFormats: ReadonlyArray<string>;
  limits: {
    maxBodyBytes: number;
    maxAttachments: number;
    maxAttachmentBytes: number;
  };
}

/**
 * Build the capability descriptor from the registry. Pure and deterministic;
 * contains no secrets. Cached per-process so repeated callers share one object.
 */
let cached: CryptoCapabilities | undefined;
export function getCryptoCapabilities(): CryptoCapabilities {
  if (cached) return cached;
  cached = {
    envelopeVersion: CRYPTO_SUITE_REGISTRY.envelopeVersion,
    suites: CRYPTO_SUITE_REGISTRY.suites.map((s) => ({ ...s })),
    keyFormats: [...CRYPTO_SUITE_REGISTRY.keyFormats],
    limits: { ...CRYPTO_SUITE_REGISTRY.limits },
  };
  return cached;
}

/** Detect drift between the registry and a descriptor (used by tests). */
export function capabilitiesMatchRegistry(caps: CryptoCapabilities): boolean {
  const reg = CRYPTO_SUITE_REGISTRY;
  if (caps.envelopeVersion !== reg.envelopeVersion) return false;
  if (caps.suites.length !== reg.suites.length) return false;
  for (let i = 0; i < reg.suites.length; i += 1) {
    const a = caps.suites[i];
    const b = reg.suites[i];
    if (a.name !== b.name || a.keyBits !== b.keyBits || a.nonceBytes !== b.nonceBytes) {
      return false;
    }
  }
  return (
    caps.keyFormats.join() === [...reg.keyFormats].join() &&
    caps.limits.maxBodyBytes === reg.limits.maxBodyBytes &&
    caps.limits.maxAttachments === reg.limits.maxAttachments &&
    caps.limits.maxAttachmentBytes === reg.limits.maxAttachmentBytes
  );
}
