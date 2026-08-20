import { ApiError } from "./errors";
import type { ApiRepository } from "./repository";
import type { KeyDirectoryRecord, PublishedKey } from "./domain";
import {
  buildKeyPublicationSigningPayload,
  verifyKeyPublicationSignature,
  type PublishKeyRequest,
  type RotateKeyRequest,
  type RetireKeyRequest,
  type RevokeKeyRequest,
  type KeyDirectoryResponse,
} from "../../features/identity/keys";

/**
 * Checks that no secret/private key data was accidentally passed in public key parameters.
 */
function assertNoPrivateKeyMaterial(publicKey: string, metadata?: Record<string, unknown>): void {
  const lowerPub = publicKey.toLowerCase();
  if (
    lowerPub.includes("private") ||
    lowerPub.includes("secret") ||
    (lowerPub.startsWith("s") && lowerPub.length === 56) // Stellar secret key format S...
  ) {
    throw new ApiError(
      400,
      "bad_request",
      "Private key material detected. The directory strictly accepts public keys only.",
    );
  }

  if (metadata) {
    const metaStr = JSON.stringify(metadata).toLowerCase();
    if (metaStr.includes("privkey") || metaStr.includes("secretkey") || metaStr.includes("seed")) {
      throw new ApiError(
        400,
        "bad_request",
        "Private key material or secret attributes detected in metadata.",
      );
    }
  }
}

/**
 * Publishes a new signed public key into an account's key directory.
 */
export async function publishKey(
  repository: ApiRepository,
  owner: string,
  request: PublishKeyRequest,
  options: { bypassSignatureCheck?: boolean } = {},
): Promise<PublishedKey> {
  const normalizedOwner = owner.trim().toUpperCase();
  assertNoPrivateKeyMaterial(request.publicKey, request.metadata);

  const now = new Date();
  const notBefore = request.notBefore ?? now.toISOString();
  // Default validity window: 1 year if not specified
  const notAfter =
    request.notAfter ?? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const dir = await repository.getKeyDirectory(normalizedOwner);
  const nextVersion = dir ? dir.keys.length + 1 : 1;
  const keyId = request.keyId || `k_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Verify signature unless explicitly in bypass mode for testing
  if (!options.bypassSignatureCheck) {
    const payload = buildKeyPublicationSigningPayload({
      owner: normalizedOwner,
      keyId,
      algorithm: request.algorithm,
      purpose: request.purpose,
      publicKey: request.publicKey,
      version: nextVersion,
      notBefore,
      notAfter,
      operation: "publish",
    });

    const isValid = verifyKeyPublicationSignature(normalizedOwner, request.signature, payload);
    if (!isValid) {
      throw new ApiError(
        401,
        "unauthorized",
        "Key publication signature verification failed for account owner",
      );
    }
  }

  const newKey: PublishedKey = {
    keyId,
    owner: normalizedOwner,
    algorithm: request.algorithm,
    purpose: request.purpose,
    publicKey: request.publicKey,
    version: nextVersion,
    notBefore,
    notAfter,
    status: "active",
    signature: request.signature,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    metadata: request.metadata,
  };

  await repository.savePublishedKey(normalizedOwner, newKey);

  // Update directory
  const currentKeys = dir ? [...dir.keys] : [];
  currentKeys.push(newKey);

  let currentEncryptionKeyId = dir?.currentEncryptionKeyId ?? null;
  let currentSigningKeyId = dir?.currentSigningKeyId ?? null;

  if (request.purpose === "encryption") {
    currentEncryptionKeyId = keyId;
  } else if (request.purpose === "signing") {
    currentSigningKeyId = keyId;
  }

  const updatedDir: KeyDirectoryRecord = {
    owner: normalizedOwner,
    currentEncryptionKeyId,
    currentSigningKeyId,
    keys: currentKeys,
    updatedAt: now.toISOString(),
    version: (dir?.version ?? 0) + 1,
  };

  await repository.saveKeyDirectory(updatedDir);
  return newKey;
}

/**
 * Rotates an active key to a new version, preserving an overlap window for in-flight messages.
 */
export async function rotateKey(
  repository: ApiRepository,
  owner: string,
  request: RotateKeyRequest,
  options: { bypassSignatureCheck?: boolean } = {},
): Promise<{ previous: PublishedKey; current: PublishedKey }> {
  const normalizedOwner = owner.trim().toUpperCase();
  assertNoPrivateKeyMaterial(request.newKey.publicKey, request.newKey.metadata);

  const currentKey = await repository.getPublishedKey(normalizedOwner, request.currentKeyId);
  if (!currentKey) {
    throw new ApiError(404, "not_found", `Current key ${request.currentKeyId} was not found`);
  }

  if (currentKey.owner !== normalizedOwner) {
    throw new ApiError(403, "forbidden", "Cannot rotate key belonging to another account");
  }

  if (currentKey.status === "revoked") {
    throw new ApiError(
      409,
      "conflict",
      "Cannot rotate a revoked key; please publish a new key instead",
    );
  }

  const now = new Date();
  const nextVersion = currentKey.version + 1;
  const newKeyId =
    request.newKey.keyId || `k_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const notBefore = request.newKey.notBefore ?? now.toISOString();
  const notAfter =
    request.newKey.notAfter ?? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

  // Signature verification on rotation intent
  if (!options.bypassSignatureCheck) {
    const payload = buildKeyPublicationSigningPayload({
      owner: normalizedOwner,
      keyId: newKeyId,
      algorithm: request.newKey.algorithm,
      purpose: request.newKey.purpose,
      publicKey: request.newKey.publicKey,
      version: nextVersion,
      notBefore,
      notAfter,
      operation: "rotate",
    });

    const isValid = verifyKeyPublicationSignature(normalizedOwner, request.signature, payload);
    if (!isValid) {
      throw new ApiError(
        401,
        "unauthorized",
        "Key rotation signature verification failed for account owner",
      );
    }
  }

  // Overlap window: former key transitions to 'rotated' (valid for verification of in-flight messages)
  const overlapMs = request.overlapPeriodMs ?? 7 * 24 * 60 * 60 * 1000; // 7 days overlap
  const rotatedKey: PublishedKey = {
    ...currentKey,
    status: "rotated",
    notAfter: new Date(now.getTime() + overlapMs).toISOString(),
    updatedAt: now.toISOString(),
  };

  const newKey: PublishedKey = {
    keyId: newKeyId,
    owner: normalizedOwner,
    algorithm: request.newKey.algorithm,
    purpose: request.newKey.purpose,
    publicKey: request.newKey.publicKey,
    version: nextVersion,
    notBefore,
    notAfter,
    status: "active",
    signature: request.newKey.signature,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    metadata: request.newKey.metadata,
  };

  await repository.savePublishedKey(normalizedOwner, rotatedKey);
  await repository.savePublishedKey(normalizedOwner, newKey);

  const dir = await repository.getKeyDirectory(normalizedOwner);
  const currentKeys = (dir?.keys ?? []).map((k) => (k.keyId === rotatedKey.keyId ? rotatedKey : k));
  currentKeys.push(newKey);

  let currentEncryptionKeyId = dir?.currentEncryptionKeyId ?? null;
  let currentSigningKeyId = dir?.currentSigningKeyId ?? null;

  if (newKey.purpose === "encryption") {
    currentEncryptionKeyId = newKeyId;
  } else if (newKey.purpose === "signing") {
    currentSigningKeyId = newKeyId;
  }

  const updatedDir: KeyDirectoryRecord = {
    owner: normalizedOwner,
    currentEncryptionKeyId,
    currentSigningKeyId,
    keys: currentKeys,
    updatedAt: now.toISOString(),
    version: (dir?.version ?? 0) + 1,
  };

  await repository.saveKeyDirectory(updatedDir);

  return {
    previous: rotatedKey,
    current: newKey,
  };
}

/**
 * Retires an active key from use.
 */
export async function retireKey(
  repository: ApiRepository,
  owner: string,
  request: RetireKeyRequest,
): Promise<PublishedKey> {
  const normalizedOwner = owner.trim().toUpperCase();
  const key = await repository.getPublishedKey(normalizedOwner, request.keyId);

  if (!key) {
    throw new ApiError(404, "not_found", `Key ${request.keyId} not found`);
  }

  if (key.owner !== normalizedOwner) {
    throw new ApiError(403, "forbidden", "Cannot retire key belonging to another account");
  }

  if (key.status === "revoked") {
    throw new ApiError(409, "conflict", "Cannot retire an already revoked key");
  }

  const now = new Date().toISOString();
  const retiredKey: PublishedKey = {
    ...key,
    status: "retired",
    updatedAt: now,
  };

  await repository.savePublishedKey(normalizedOwner, retiredKey);

  const dir = await repository.getKeyDirectory(normalizedOwner);
  if (dir) {
    const updatedKeys = dir.keys.map((k) => (k.keyId === key.keyId ? retiredKey : k));
    let currentEncryptionKeyId = dir.currentEncryptionKeyId;
    let currentSigningKeyId = dir.currentSigningKeyId;

    if (dir.currentEncryptionKeyId === key.keyId) {
      currentEncryptionKeyId = null;
    }
    if (dir.currentSigningKeyId === key.keyId) {
      currentSigningKeyId = null;
    }

    await repository.saveKeyDirectory({
      ...dir,
      currentEncryptionKeyId,
      currentSigningKeyId,
      keys: updatedKeys,
      updatedAt: now,
      version: dir.version + 1,
    });
  }

  return retiredKey;
}

/**
 * Revokes a key due to compromise or decommission.
 * Immediately invalidates active encryption; historical verification follows revokedAt timestamp.
 */
export async function revokeKey(
  repository: ApiRepository,
  owner: string,
  request: RevokeKeyRequest & { revokedAt?: string },
): Promise<PublishedKey> {
  const normalizedOwner = owner.trim().toUpperCase();
  const key = await repository.getPublishedKey(normalizedOwner, request.keyId);

  if (!key) {
    throw new ApiError(404, "not_found", `Key ${request.keyId} not found`);
  }

  if (key.owner !== normalizedOwner) {
    throw new ApiError(403, "forbidden", "Cannot revoke key belonging to another account");
  }

  const now = request.revokedAt ?? new Date().toISOString();
  const revokedKey: PublishedKey = {
    ...key,
    status: "revoked",
    revokedAt: now,
    revocationReason: request.reason,
    updatedAt: new Date().toISOString(),
  };

  await repository.savePublishedKey(normalizedOwner, revokedKey);

  const dir = await repository.getKeyDirectory(normalizedOwner);
  if (dir) {
    const updatedKeys = dir.keys.map((k) => (k.keyId === key.keyId ? revokedKey : k));
    let currentEncryptionKeyId = dir.currentEncryptionKeyId;
    let currentSigningKeyId = dir.currentSigningKeyId;

    if (dir.currentEncryptionKeyId === key.keyId) {
      currentEncryptionKeyId = null;
    }
    if (dir.currentSigningKeyId === key.keyId) {
      currentSigningKeyId = null;
    }

    await repository.saveKeyDirectory({
      ...dir,
      currentEncryptionKeyId,
      currentSigningKeyId,
      keys: updatedKeys,
      updatedAt: now,
      version: dir.version + 1,
    });
  }

  return revokedKey;
}

/**
 * Retrieves the full key directory for an account, separating current keys and permitted historical keys.
 */
export async function getKeyDirectory(
  repository: ApiRepository,
  owner: string,
): Promise<KeyDirectoryResponse> {
  const normalizedOwner = owner.trim().toUpperCase();
  const dir = await repository.getKeyDirectory(normalizedOwner);

  const nowIso = new Date().toISOString();
  const allKeys = dir?.keys ?? [];

  let currentEncryptionKey: PublishedKey | null = null;
  let currentSigningKey: PublishedKey | null = null;

  if (dir?.currentEncryptionKeyId) {
    currentEncryptionKey =
      allKeys.find((k) => k.keyId === dir.currentEncryptionKeyId && k.status === "active") ?? null;
  }
  if (dir?.currentSigningKeyId) {
    currentSigningKey =
      allKeys.find((k) => k.keyId === dir.currentSigningKeyId && k.status === "active") ?? null;
  }

  // Historical keys: non-active keys or keys rotated from previous versions
  const historicalKeys = allKeys.filter(
    (k) => k.keyId !== dir?.currentEncryptionKeyId && k.keyId !== dir?.currentSigningKeyId,
  );

  return {
    owner: normalizedOwner,
    currentKeys: {
      encryption: currentEncryptionKey,
      signing: currentSigningKey,
    },
    historicalKeys,
    allKeys,
    version: dir?.version ?? 1,
    updatedAt: dir?.updatedAt ?? nowIso,
    freshness: {
      resolvedAt: nowIso,
      cached: false,
      ttlMs: 300000, // 5 minutes
    },
  };
}

/**
 * Retrieves a single published key by ID.
 */
export async function getKey(
  repository: ApiRepository,
  owner: string,
  keyId: string,
): Promise<PublishedKey | null> {
  const normalizedOwner = owner.trim().toUpperCase();
  return repository.getPublishedKey(normalizedOwner, keyId);
}
