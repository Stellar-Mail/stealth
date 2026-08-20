/**
 * Envelope encryption for server-managed Stellar wallet seeds.
 *
 * This is deliberately a server-only primitive.  Callers can create, persist,
 * rewrap and use a sealed wallet, but can never ask it to return a seed.
 */
import { fromBase64, toBase64 } from "./codec";
import { openAead, sealAead } from "./aead";
import { clearSecret, disposeRawKey } from "./secret-buffer";

export const MANAGED_WALLET_ENVELOPE_VERSION = 1;
const DATA_KEY_BYTES = 32;
const SEED_BYTES = 56;

export class ManagedWalletCryptoError extends Error {
  readonly code = "managed_wallet_crypto_error" as const;
  constructor(message = "Managed wallet cryptographic operation failed") {
    super(message);
    this.name = "ManagedWalletCryptoError";
  }
}

export interface ManagedWalletEnvelope {
  readonly version: typeof MANAGED_WALLET_ENVELOPE_VERSION;
  readonly address: string;
  readonly masterKeyVersion: string;
  /** AES-GCM ciphertext of the seed; this is the only seed representation persisted. */
  readonly encryptedSeed: string;
  readonly seedNonce: string;
  readonly seedTag: string;
  /** AES-GCM ciphertext of the per-wallet data key under the versioned master key. */
  readonly wrappedDataKey: string;
  readonly dataKeyNonce: string;
  readonly dataKeyTag: string;
}

/** Persistence contract: records contain public ownership metadata plus a sealed envelope only. */
export interface ManagedWalletRecord {
  readonly owner: string;
  readonly envelope: ManagedWalletEnvelope;
  readonly updatedAt: string;
}

export interface ManagedWalletStore {
  get(owner: string): Promise<ManagedWalletRecord | null>;
  /** Compare-and-swap prevents a concurrent rotation from silently overwriting another. */
  compareAndSet(
    owner: string,
    expectedUpdatedAt: string | null,
    record: ManagedWalletRecord,
  ): Promise<boolean>;
}

export class MemoryManagedWalletStore implements ManagedWalletStore {
  private readonly records = new Map<string, ManagedWalletRecord>();

  async get(owner: string): Promise<ManagedWalletRecord | null> {
    return this.records.get(owner) ?? null;
  }

  async compareAndSet(
    owner: string,
    expectedUpdatedAt: string | null,
    record: ManagedWalletRecord,
  ): Promise<boolean> {
    const current = this.records.get(owner);
    if ((current?.updatedAt ?? null) !== expectedUpdatedAt) return false;
    this.records.set(owner, record);
    return true;
  }
}

export interface MasterKeyProvider {
  activeVersion(): string;
  get(version: string): Promise<CryptoKey | null>;
}

/** In-memory provider useful for worker bindings and tests; key bytes are imported, not retained. */
export class VersionedMasterKeyProvider implements MasterKeyProvider {
  private readonly keys = new Map<string, CryptoKey>();

  private constructor(private readonly active: string) {}

  static async fromBase64(activeVersion: string, keys: Record<string, string>) {
    if (!activeVersion || !keys[activeVersion])
      throw new ManagedWalletCryptoError("Active key is unavailable");
    const provider = new VersionedMasterKeyProvider(activeVersion);
    for (const [version, encoded] of Object.entries(keys)) {
      const bytes = fromBase64(encoded, DATA_KEY_BYTES);
      try {
        provider.keys.set(
          version,
          await crypto.subtle.importKey("raw", bytes.slice().buffer, { name: "AES-GCM" }, false, [
            "encrypt",
            "decrypt",
          ]),
        );
      } finally {
        clearSecret(bytes);
      }
    }
    return provider;
  }

  activeVersion(): string {
    return this.active;
  }

  async get(version: string): Promise<CryptoKey | null> {
    return this.keys.get(version) ?? null;
  }
}

function aad(address: string): Uint8Array {
  return new TextEncoder().encode(`stealth:managed-wallet:v1:${address}`);
}

async function dataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

async function requireMasterKey(provider: MasterKeyProvider, version: string): Promise<CryptoKey> {
  const key = await provider.get(version);
  if (!key) throw new ManagedWalletCryptoError("Required master key is unavailable");
  return key;
}

async function unwrapDataKey(
  envelope: ManagedWalletEnvelope,
  provider: MasterKeyProvider,
): Promise<CryptoKey> {
  const masterKey = await requireMasterKey(provider, envelope.masterKeyVersion);
  let raw: Uint8Array | undefined;
  try {
    const opened = await openAead(
      masterKey,
      fromBase64(envelope.wrappedDataKey),
      fromBase64(envelope.dataKeyTag),
      fromBase64(envelope.dataKeyNonce),
      aad(envelope.address),
    );
    raw = opened.plaintext;
    if (raw.length !== DATA_KEY_BYTES) throw new ManagedWalletCryptoError();
    return await crypto.subtle.importKey("raw", raw.slice().buffer, { name: "AES-GCM" }, true, [
      "encrypt",
      "decrypt",
    ]);
  } catch (error) {
    if (error instanceof ManagedWalletCryptoError) throw error;
    throw new ManagedWalletCryptoError();
  } finally {
    if (raw) clearSecret(raw);
  }
}

export async function sealManagedWalletSeed(
  seed: string,
  address: string,
  provider: MasterKeyProvider,
): Promise<ManagedWalletEnvelope> {
  const seedBytes = new TextEncoder().encode(seed);
  let rawDataKey: ArrayBuffer | undefined;
  try {
    if (seedBytes.length !== SEED_BYTES || !/^S[A-Z2-7]{55}$/.test(seed)) {
      throw new ManagedWalletCryptoError("Managed wallet seed is invalid");
    }
    const key = await dataKey();
    const seedPart = await sealAead(key, seedBytes, undefined, aad(address));
    rawDataKey = await crypto.subtle.exportKey("raw", key);
    const masterKeyVersion = provider.activeVersion();
    const wrapped = await sealAead(
      await requireMasterKey(provider, masterKeyVersion),
      new Uint8Array(rawDataKey),
      undefined,
      aad(address),
    );
    return {
      version: MANAGED_WALLET_ENVELOPE_VERSION,
      address,
      masterKeyVersion,
      encryptedSeed: toBase64(seedPart.ciphertext),
      seedNonce: toBase64(seedPart.nonce),
      seedTag: toBase64(seedPart.tag),
      wrappedDataKey: toBase64(wrapped.ciphertext),
      dataKeyNonce: toBase64(wrapped.nonce),
      dataKeyTag: toBase64(wrapped.tag),
    };
  } catch (error) {
    if (error instanceof ManagedWalletCryptoError) throw error;
    throw new ManagedWalletCryptoError();
  } finally {
    clearSecret(seedBytes);
    if (rawDataKey) disposeRawKey(rawDataKey);
  }
}

/** Decrypt only for the duration of `useSeed`; the plaintext buffer is always cleared. */
export async function withManagedWalletSeed<T>(
  envelope: ManagedWalletEnvelope,
  provider: MasterKeyProvider,
  action: (seed: string) => Promise<T> | T,
): Promise<T> {
  if (envelope.version !== MANAGED_WALLET_ENVELOPE_VERSION) throw new ManagedWalletCryptoError();
  let seedBytes: Uint8Array | undefined;
  try {
    const key = await unwrapDataKey(envelope, provider);
    seedBytes = (
      await openAead(
        key,
        fromBase64(envelope.encryptedSeed),
        fromBase64(envelope.seedTag),
        fromBase64(envelope.seedNonce),
        aad(envelope.address),
      )
    ).plaintext;
    if (seedBytes.length !== SEED_BYTES) throw new ManagedWalletCryptoError();
    return await action(new TextDecoder().decode(seedBytes));
  } catch (error) {
    if (error instanceof ManagedWalletCryptoError) throw error;
    throw new ManagedWalletCryptoError();
  } finally {
    if (seedBytes) clearSecret(seedBytes);
  }
}

/** Rewraps only the data key, retaining the seed ciphertext and Stellar address unchanged. */
export async function rewrapManagedWallet(
  envelope: ManagedWalletEnvelope,
  provider: MasterKeyProvider,
  targetVersion = provider.activeVersion(),
): Promise<ManagedWalletEnvelope> {
  if (envelope.masterKeyVersion === targetVersion) return envelope;
  let rawDataKey: ArrayBuffer | undefined;
  try {
    const key = await unwrapDataKey(envelope, provider);
    rawDataKey = await crypto.subtle.exportKey("raw", key);
    const wrapped = await sealAead(
      await requireMasterKey(provider, targetVersion),
      new Uint8Array(rawDataKey),
      undefined,
      aad(envelope.address),
    );
    return {
      ...envelope,
      masterKeyVersion: targetVersion,
      wrappedDataKey: toBase64(wrapped.ciphertext),
      dataKeyNonce: toBase64(wrapped.nonce),
      dataKeyTag: toBase64(wrapped.tag),
    };
  } catch (error) {
    if (error instanceof ManagedWalletCryptoError) throw error;
    throw new ManagedWalletCryptoError();
  } finally {
    if (rawDataKey) disposeRawKey(rawDataKey);
  }
}
