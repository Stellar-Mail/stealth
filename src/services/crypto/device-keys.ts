/**
 * Device-specific recipient encryption keys (#1714).
 *
 * The envelope model assumes one recipient address with no device-key
 * representation, so a user with multiple devices has no way to receive
 * decryptable messages without copying one long-lived private key to every
 * device.
 *
 * This module adds a per-recipient device registry and wraps the message
 * content key to every *active* registered device. It does not reimplement
 * key-wrapping crypto: `recipient-privacy.ts` (#1712-adjacent work) already
 * provides an audited ECDH(P-256) + HKDF-SHA256 + AES-256-GCM scheme that
 * wraps a content key to a public key behind a blinded, ECDH-derived
 * identifier indistinguishable from random without the matching private key
 * — exactly the "device identifiers reveal minimal metadata" requirement.
 * Each device is simply treated as one recipient-privacy entry.
 *
 * The local, registry-facing `deviceId` (used for add/remove/list — never
 * placed on the wire) reuses `key-id.ts`'s `deriveKeyId`: a SHA-256 hash of
 * the device's public key. This is deterministic and collision-resistant,
 * and — like the wire-level blinded ID — reveals nothing about the device
 * itself (no name, OS, or hardware fingerprint), only that it names a
 * specific registered public key.
 *
 * Self-contained (local DeviceKeyError) so this branch is independently
 * mergeable, consistent with sibling crypto submodules (aead.ts, kdf.ts,
 * key-resolver.ts).
 */

import { createPrivacyEntry, generateEcdhKeyPair } from "./recipient-privacy";
import { deriveKeyId } from "./key-id";
import { fromBase64, toBase64 } from "./codec";
import type { PrivacyPreservingRecipientEntry } from "./recipient-privacy";

/** Minimal non-secret error carrying a stable code (no key/plaintext leakage). */
export class DeviceKeyError extends Error {
  readonly code = "crypto_key_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "DeviceKeyError";
  }
}

/** Opaque, registry-facing device identifier. Derived from the device's own
 * public key (see key-id.ts) — never from a name, OS, or hardware
 * fingerprint. Used only for local add/remove/list bookkeeping; it is never
 * placed on the wire (see `wrappedKeys` below, which carries only the
 * already-blinded `PrivacyPreservingRecipientEntry` shape). */
export type DeviceId = string;

/** A recipient's registered device. `publicKey` is base64 SPKI, matching the
 * wire encoding already used by recipient-privacy.ts. */
export interface DeviceRecord {
  deviceId: DeviceId;
  publicKey: string; // base64 SPKI
  addedAt: string; // ISO 8601
  revokedAt: string | null; // ISO 8601, null while active
}

/**
 * Manages the set of device entries for a single recipient. Removed devices
 * are retained with a `revokedAt` timestamp rather than deleted, so history
 * stays auditable — but `activeDevices()`, the only source
 * `wrapContentKeyForActiveDevices` reads from, excludes them. That is the
 * single enforcement point for "removed devices stop receiving new wrapped
 * keys": there is no other path by which a device receives a wrapped key.
 */
export class RecipientDeviceRegistry {
  private devices = new Map<DeviceId, DeviceRecord>();

  /**
   * Registers a new active device from its SPKI-encoded public key. The
   * device identifier is derived deterministically from the key itself, so
   * registering the same public key twice is rejected rather than silently
   * creating a duplicate active entry.
   */
  async addDevice(publicKeySpkiBase64: string, now: Date = new Date()): Promise<DeviceRecord> {
    const rawSpki = fromBase64(publicKeySpkiBase64);
    const deviceId = await deriveKeyId(rawSpki);
    if (this.devices.has(deviceId)) {
      throw new DeviceKeyError("device already registered");
    }
    const record: DeviceRecord = {
      deviceId,
      publicKey: publicKeySpkiBase64,
      addedAt: now.toISOString(),
      revokedAt: null,
    };
    this.devices.set(deviceId, record);
    return record;
  }

  /** Marks a device as removed. It stops receiving wrapped keys for any
   * message encrypted after this call; idempotent on an already-removed
   * device. */
  removeDevice(deviceId: DeviceId, now: Date = new Date()): void {
    const record = this.devices.get(deviceId);
    if (!record) {
      throw new DeviceKeyError("unknown device");
    }
    if (record.revokedAt !== null) return;
    record.revokedAt = now.toISOString();
  }

  isActive(deviceId: DeviceId): boolean {
    return this.devices.get(deviceId)?.revokedAt === null;
  }

  activeDevices(): DeviceRecord[] {
    return [...this.devices.values()].filter((d) => d.revokedAt === null);
  }

  getDevice(deviceId: DeviceId): DeviceRecord | undefined {
    return this.devices.get(deviceId);
  }
}

/** One device's wrapped content key. `entry` is the same shape produced for
 * any recipient-privacy recipient — a blinded ID plus wrapped key, carrying
 * no device metadata. `deviceId` is attached alongside purely for the
 * sender-side registry bookkeeping (e.g. auditing which active devices a
 * message was wrapped for); it plays no role in decryption or on-the-wire
 * matching, which is handled entirely by the blinded ID in `entry`. */
export interface DeviceWrappedKey {
  deviceId: DeviceId;
  entry: PrivacyPreservingRecipientEntry;
}

async function importSpkiPublicKey(spkiBase64: string): Promise<CryptoKey> {
  try {
    const rawSpki = fromBase64(spkiBase64);
    return await crypto.subtle.importKey(
      "spki",
      rawSpki as BufferSource,
      { name: "ECDH", namedCurve: "P-256" },
      true,
      [],
    );
  } catch {
    throw new DeviceKeyError("invalid device public key");
  }
}

/**
 * Wraps a content key to every currently active device in the registry.
 * Devices marked as removed are skipped entirely by construction, since this
 * reads only from `registry.activeDevices()`.
 */
export async function wrapContentKeyForActiveDevices(
  contentKey: CryptoKey,
  registry: RecipientDeviceRegistry,
): Promise<DeviceWrappedKey[]> {
  const active = registry.activeDevices();
  return Promise.all(
    active.map(async (device) => {
      const publicKey = await importSpkiPublicKey(device.publicKey);
      const entry = await createPrivacyEntry(publicKey, contentKey);
      return { deviceId: device.deviceId, entry };
    }),
  );
}

export async function generateDeviceKeyPair(): Promise<{
  privateKey: CryptoKey;
  publicKeySpkiBase64: string;
}> {
  const keyPair = await generateEcdhKeyPair();

  const spki = await crypto.subtle.exportKey("spki", keyPair.publicKey);

  return {
    privateKey: keyPair.privateKey,
    publicKeySpkiBase64: btoa(String.fromCharCode(...new Uint8Array(spki))),
  };
}

export function hasActiveDevices(registry: RecipientDeviceRegistry): boolean {
  return registry.activeDevices().length !== 0;
}
