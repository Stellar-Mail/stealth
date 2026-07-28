/**
 * Runtime crypto adapter with capability checking
 *
 * This module validates required crypto primitives before use
 * and provides injectable implementations for tests.
 */

/**
 * Runtime capability error types
 */
export enum CryptoCapability {
  GLOBAL_CRYPTO = "globalCrypto",
  SUBTLE_CRYPTO = "subtleCrypto",
  BTOA = "btoa",
  ATob = "atob",
  TEXT_ENCODER = "textEncoder",
  TEXT_DECODER = "textDecoder",
  RANDOM_VALUES = "randomValues",
}

/**
 * Crypto capability error
 */
export class CryptoCapabilityError extends Error {
  constructor(
    public capability: CryptoCapability,
    message: string,
  ) {
    super(`[${capability}] ${message}`);
    this.name = "CryptoCapabilityError";
  }
}

/**
 * Type-safe crypto interface
 */
export interface CryptoAdapter {
  /** Global crypto object */
  crypto: Crypto;
  /** Web Crypto subtle interface */
  subtle: SubtleCrypto;
  /** Base64 encode */
  btoa: (data: string) => string;
  /** Base64 decode */
  atob: (data: string) => string;
  /** Text encoder */
  encode: (data: string) => Uint8Array;
  /** Text decoder */
  decode: (data: Uint8Array) => string;
  /** Secure random values */
  randomBytes: (length: number) => Uint8Array;
}

/**
 * Runtime capability checker
 *
 * @param throwOnMissing - Whether to throw errors on missing capabilities
 * @returns A map of capabilities to their availability
 */
export function checkCapabilities(throwOnMissing: boolean = true): Map<CryptoCapability, boolean> {
  const capabilities = new Map<CryptoCapability, boolean>();

  // Check global crypto
  const hasCrypto = typeof globalThis !== "undefined" && "crypto" in globalThis;
  capabilities.set(CryptoCapability.GLOBAL_CRYPTO, hasCrypto);

  if (!hasCrypto && throwOnMissing) {
    throw new CryptoCapabilityError(
      CryptoCapability.GLOBAL_CRYPTO,
      "global crypto is not available in this environment",
    );
  }

  // Check subtle crypto
  const hasSubtle =
    hasCrypto && "subtle" in globalThis.crypto && typeof globalThis.crypto.subtle !== "undefined";
  capabilities.set(CryptoCapability.SUBTLE_CRYPTO, hasSubtle);

  if (!hasSubtle && throwOnMissing) {
    throw new CryptoCapabilityError(
      CryptoCapability.SUBTLE_CRYPTO,
      "Web Crypto subtle is not available in this environment",
    );
  }

  // Check btoa
  const hasBtoa = typeof globalThis.btoa === "function" && typeof globalThis.atob === "function";
  capabilities.set(CryptoCapability.BTOA, hasBtoa);

  if (!hasBtoa && throwOnMissing) {
    throw new CryptoCapabilityError(
      CryptoCapability.BTOA,
      "base64 encode/decode (btoa/atob) is not available in this environment",
    );
  }

  // Check TextEncoder/TextDecoder
  const hasTextEncoder =
    typeof globalThis.TextEncoder === "function" && typeof globalThis.TextDecoder === "function";
  capabilities.set(CryptoCapability.TEXT_ENCODER, hasTextEncoder);

  if (!hasTextEncoder && throwOnMissing) {
    throw new CryptoCapabilityError(
      CryptoCapability.TEXT_ENCODER,
      "TextEncoder/TextDecoder is not available in this environment",
    );
  }

  // Check random values (getRandomValues)
  const hasRandomValues = hasCrypto && "getRandomValues" in globalThis.crypto;
  capabilities.set(CryptoCapability.RANDOM_VALUES, hasRandomValues);

  if (!hasRandomValues && throwOnMissing) {
    throw new CryptoCapabilityError(
      CryptoCapability.RANDOM_VALUES,
      "crypto.getRandomValues is not available in this environment",
    );
  }

  return capabilities;
}

/**
 * Create a crypto adapter for the current runtime
 *
 * @throws {CryptoCapabilityError} If required capabilities are missing
 * @returns A fully configured CryptoAdapter
 */
export function createCryptoAdapter(): CryptoAdapter {
  const capabilities = checkCapabilities(true);

  // Validate all required capabilities are present
  const required: CryptoCapability[] = [
    CryptoCapability.GLOBAL_CRYPTO,
    CryptoCapability.SUBTLE_CRYPTO,
    CryptoCapability.BTOA,
    CryptoCapability.TEXT_ENCODER,
    CryptoCapability.RANDOM_VALUES,
  ];

  for (const cap of required) {
    if (!capabilities.get(cap)) {
      throw new CryptoCapabilityError(cap, `Required capability ${cap} is not available`);
    }
  }

  // The actual crypto object (with all methods)
  const crypto = globalThis.crypto;

  return {
    crypto: crypto,
    subtle: crypto.subtle,
    btoa: (data: string) => {
      if (typeof globalThis.btoa !== "function") {
        throw new CryptoCapabilityError(CryptoCapability.BTOA, "btoa is not available");
      }
      return globalThis.btoa(data);
    },
    atob: (data: string) => {
      if (typeof globalThis.atob !== "function") {
        throw new CryptoCapabilityError(CryptoCapability.ATob, "atob is not available");
      }
      return globalThis.atob(data);
    },
    encode: (data: string) => {
      if (typeof globalThis.TextEncoder !== "function") {
        throw new CryptoCapabilityError(
          CryptoCapability.TEXT_ENCODER,
          "TextEncoder is not available",
        );
      }
      return new globalThis.TextEncoder().encode(data);
    },
    decode: (data: Uint8Array) => {
      if (typeof globalThis.TextDecoder !== "function") {
        throw new CryptoCapabilityError(
          CryptoCapability.TEXT_DECODER,
          "TextDecoder is not available",
        );
      }
      return new globalThis.TextDecoder().decode(data);
    },
    randomBytes: (length: number): Uint8Array => {
      if (typeof globalThis.crypto?.getRandomValues !== "function") {
        throw new CryptoCapabilityError(
          CryptoCapability.RANDOM_VALUES,
          "crypto.getRandomValues is not available",
        );
      }
      // In production, never fall back to insecure randomness
      const array = new Uint8Array(length);
      globalThis.crypto.getRandomValues(array);
      return array;
    },
  };
}

/**
 * Create a test adapter with mocked implementations
 */
export function createTestAdapter(overrides: Partial<CryptoAdapter> = {}): CryptoAdapter {
  const defaultAdapter: CryptoAdapter = {
    crypto: globalThis.crypto,
    subtle: globalThis.crypto.subtle,
    btoa: (data: string) => globalThis.btoa(data),
    atob: (data: string) => globalThis.atob(data),
    encode: (data: string) => new globalThis.TextEncoder().encode(data),
    decode: (data: Uint8Array) => new globalThis.TextDecoder().decode(data),
    randomBytes: (length: number) => {
      const array = new Uint8Array(length);
      globalThis.crypto.getRandomValues(array);
      return array;
    },
  };

  return {
    ...defaultAdapter,
    ...overrides,
  };
}

/**
 * Create a mock adapter for testing missing capabilities
 */
export function createMockAdapterWithMissingCapabilities(
  missing: CryptoCapability[],
): Partial<CryptoAdapter> {
  const mock: Partial<CryptoAdapter> = {};

  if (!missing.includes(CryptoCapability.GLOBAL_CRYPTO)) {
    mock.crypto = globalThis.crypto;
  }

  if (!missing.includes(CryptoCapability.SUBTLE_CRYPTO)) {
    mock.subtle = globalThis.crypto.subtle;
  }

  if (!missing.includes(CryptoCapability.BTOA)) {
    mock.btoa = (data: string) => globalThis.btoa(data);
  }

  if (!missing.includes(CryptoCapability.ATob)) {
    mock.atob = (data: string) => globalThis.atob(data);
  }

  if (!missing.includes(CryptoCapability.TEXT_ENCODER)) {
    mock.encode = (data: string) => new globalThis.TextEncoder().encode(data);
  }

  if (!missing.includes(CryptoCapability.TEXT_DECODER)) {
    mock.decode = (data: Uint8Array) => new globalThis.TextDecoder().decode(data);
  }

  if (!missing.includes(CryptoCapability.RANDOM_VALUES)) {
    mock.randomBytes = (length: number) => {
      const array = new Uint8Array(length);
      globalThis.crypto.getRandomValues(array);
      return array;
    };
  }

  return mock;
}

/**
 * Get a string describing the current runtime environment
 */
export function getRuntimeInfo(): string {
  if (typeof globalThis === "undefined") {
    return "Unknown runtime";
  }

  if (typeof globalThis.WorkerGlobalScope !== "undefined") {
    return "Web Worker";
  }

  if (typeof globalThis.window !== "undefined") {
    return "Browser";
  }

  if (typeof globalThis.process !== "undefined") {
    return "Node.js";
  }

  if (typeof globalThis.Deno !== "undefined") {
    return "Deno";
  }

  return "Unknown runtime";
}
