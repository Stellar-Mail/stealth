/**
 * Recipient key resolution for the send path (BETA-046 / #1953).
 *
 * Bridges the versioned public key directory (BETA-027) to the compose
 * pipeline. For each recipient account the current encryption key is fetched
 * from `/api/v1/identity/keys/?owner=<G...>`, validated against the send-path
 * domain rules (see `src/services/crypto/sendRecipientValidation.ts`), and
 * returned as envelope-ready key material. No secrets ever leave the client.
 */
import { DirectoryRecipientKeyResolver, resolveTrustedKey } from "@/services/crypto/key-resolver";
import {
  recipientKeyToMaterial,
  RecipientKeyRejectedError,
  type RecipientKeyMaterial,
} from "@/services/crypto/sendRecipientValidation";
import type { KeyDirectoryResponse } from "@/features/identity/keys";
import { MAX_RECIPIENT_KEYS } from "@/services/crypto/limits";

export type {
  RecipientKeyMaterial,
  SendRecipientRejection,
} from "@/services/crypto/sendRecipientValidation";
export { RecipientKeyRejectedError } from "@/services/crypto/sendRecipientValidation";

/** Thrown when any recipient account fails to resolve to a usable key. */
export class RecipientKeyResolutionError extends Error {
  readonly recipient: string;
  constructor(recipient: string, message: string) {
    super(message);
    this.name = "RecipientKeyResolutionError";
    this.recipient = recipient;
  }
}

/**
 * Fetch the versioned public key directory for a Stellar account from the
 * real API path (BETA-027). Returns null when the directory is missing or the
 * request fails so callers can map it to a recoverable error stage.
 */
export async function fetchKeyDirectory(
  owner: string,
  signal?: AbortSignal,
): Promise<KeyDirectoryResponse | null> {
  const url = `/api/v1/identity/keys/?owner=${encodeURIComponent(owner.trim().toUpperCase())}`;
  try {
    const response = await fetch(url, { headers: { accept: "application/json" }, signal });
    if (!response.ok) return null;
    const json = (await response.json().catch(() => null)) as {
      data?: KeyDirectoryResponse;
    } | null;
    return json?.data ?? null;
  } catch (error: any) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return null;
  }
}

/** Default resolver wired to the live key-directory endpoint. */
export function createKeyDirectoryResolver(): DirectoryRecipientKeyResolver {
  return new DirectoryRecipientKeyResolver(async (owner) => {
    const dir = await fetchKeyDirectory(owner);
    return dir ? { ...dir, currentKeys: dir.currentKeys ?? {} } : null;
  });
}

/**
 * Resolve and validate the current encryption key for a single recipient
 * account. Throws {@link RecipientKeyResolutionError} wrapping a stable
 * rejection code when the key cannot be used.
 */
export async function resolveRecipientKeyForSend(
  account: string,
  resolver: DirectoryRecipientKeyResolver = createKeyDirectoryResolver(),
): Promise<RecipientKeyMaterial> {
  const normalized = account.trim().toUpperCase();
  try {
    const resolved = await resolveTrustedKey(resolver, normalized);
    return await recipientKeyToMaterial(resolved, normalized);
  } catch (error) {
    if (error instanceof RecipientKeyRejectedError) {
      throw new RecipientKeyResolutionError(normalized, `Recipient key rejected: ${error.code}`);
    }
    if (error instanceof Error) {
      throw new RecipientKeyResolutionError(
        normalized,
        `Recipient key unavailable: ${error.message}`,
      );
    }
    throw new RecipientKeyResolutionError(normalized, "Recipient key unavailable");
  }
}

/**
 * Resolve and validate keys for every recipient account. Duplicate accounts
 * collapse to a single entry; a missing or unusable key for any recipient
 * rejects the whole batch before any encryption or signing occurs.
 */
export async function resolveRecipientKeysForSend(
  accounts: string[],
  resolver: DirectoryRecipientKeyResolver = createKeyDirectoryResolver(),
): Promise<RecipientKeyMaterial[]> {
  const unique = Array.from(new Set(accounts.map((a) => a.trim().toUpperCase())));
  if (unique.length === 0) {
    throw new RecipientKeyResolutionError("", "At least one recipient account is required");
  }
  if (unique.length > MAX_RECIPIENT_KEYS) {
    throw new RecipientKeyResolutionError("", `Too many recipients (max ${MAX_RECIPIENT_KEYS})`);
  }
  return Promise.all(unique.map((account) => resolveRecipientKeyForSend(account, resolver)));
}
