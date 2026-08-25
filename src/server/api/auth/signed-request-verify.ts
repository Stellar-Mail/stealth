import { randomBytes } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";

import { stellarAddressSchema } from "../domain";
import { ApiError } from "../errors";
import type { ApiPrincipal } from "../context";
import { AUTH_TIMING_REASONS, getAuthChallengeConfig } from "./challenge";
import {
  getAuthNonceTtlMs,
  InMemoryNonceStore,
  type NonceRecord,
  type NonceStore,
} from "./nonce-service";
import {
  SIGNED_REQUEST_VERSION,
  canonicalizeSignedRequest,
  signedRequestTimeStatus,
  signedRequestTimingReason,
  validateSignedRequestAudience,
} from "./signed-request";

export const SIGNED_REQUEST_PURPOSE = "signed-request";
export const SIGNATURE_HEADER = "x-stealth-signature";
export const VERSION_HEADER = "x-stealth-version";

const NONCE_HEX_RE = /^[0-9a-f]{64}$/;
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const globalAuth = globalThis as typeof globalThis & {
  __stealthSignedRequestNonceStore?: NonceStore;
};

export function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
}

/**
 * Development identity transport (`x-stealth-address` alone). Disabled in
 * production builds and whenever `STEALTH_AUTH_REQUIRE_SIGNED=1`.
 * Opt-in only via `STEALTH_AUTH_ALLOW_HEADER_ONLY=1`.
 */
export function isHeaderOnlyAuthAllowed(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  if (import.meta.env.PROD) return false;
  if (environment.STEALTH_AUTH_REQUIRE_SIGNED === "1") return false;
  return environment.STEALTH_AUTH_ALLOW_HEADER_ONLY === "1";
}

export function hasSignedRequestMaterial(request: Request): boolean {
  return Boolean(
    request.headers.get(SIGNATURE_HEADER) ||
    request.headers.get("x-stealth-nonce") ||
    request.headers.get("x-stealth-timestamp") ||
    request.headers.get("x-stealth-audience") ||
    request.headers.get(VERSION_HEADER),
  );
}

export function getActiveAudiences(
  request: Request,
  environment: Record<string, string | undefined> = process.env,
): Set<string> {
  const configured = environment.STEALTH_AUTH_AUDIENCES;
  if (configured && configured.trim()) {
    return new Set(
      configured
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
  }

  const audiences = new Set<string>(["stealth.test", "stealth-api.example.test"]);
  try {
    const host = new URL(request.url).host;
    if (host) audiences.add(host);
  } catch {
    // ignore malformed URL; audience validation will fail closed
  }
  return audiences;
}

export function getSignedRequestNonceStore(): NonceStore {
  globalAuth.__stealthSignedRequestNonceStore ??= new InMemoryNonceStore();
  return globalAuth.__stealthSignedRequestNonceStore;
}

/** Test helper: replace or clear the process-wide replay store. */
export function resetSignedRequestNonceStore(store?: NonceStore): void {
  if (store) {
    globalAuth.__stealthSignedRequestNonceStore = store;
    return;
  }
  const current = globalAuth.__stealthSignedRequestNonceStore;
  if (current && "reset" in current && typeof current.reset === "function") {
    current.reset();
  } else {
    globalAuth.__stealthSignedRequestNonceStore = new InMemoryNonceStore();
  }
}

function requireHeader(request: Request, name: string): string {
  const value = request.headers.get(name)?.trim();
  if (!value) {
    throw new ApiError(401, "unauthorized", `Missing ${name} header`);
  }
  return value.replace(/[\t ]+/g, " ");
}

function headersRecord(request: Request): Record<string, string> {
  const record: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  if (!record.host) {
    try {
      record.host = new URL(request.url).host;
    } catch {
      // validate later
    }
  }
  return record;
}

function verifyEd25519Signature(address: string, message: string, signature: string): boolean {
  try {
    const isBase64 = signature.length === 88 && !/^[0-9a-fA-F]+$/.test(signature);
    const sigBuf = Buffer.from(signature, isBase64 ? "base64" : "hex");
    const kp = Keypair.fromPublicKey(address);
    return kp.verify(Buffer.from(message, "utf8"), sigBuf);
  } catch {
    return false;
  }
}

/**
 * Atomically record a client-generated (actor, nonce) pair for the validity
 * window. A second insert of the same nonce is treated as replay.
 */
export async function consumeSignedRequestNonce(
  actor: string,
  nonce: string,
  options: {
    store?: NonceStore;
    nowMs?: number;
    ttlMs?: number;
    environment?: Record<string, string | undefined>;
  } = {},
): Promise<void> {
  if (!NONCE_HEX_RE.test(nonce)) {
    throw new ApiError(401, "unauthorized", "Invalid x-stealth-nonce header");
  }

  const env = options.environment ?? process.env;
  const store = options.store ?? getSignedRequestNonceStore();
  const nowMs = options.nowMs ?? Date.now();
  const ttlMs = options.ttlMs ?? getAuthNonceTtlMs(env);
  const key = `auth:nonce:${nonce}`;

  const existing = await store.get(key);
  if (existing) {
    throw new ApiError(409, "conflict", "The authentication nonce has already been used");
  }

  const record: NonceRecord = {
    nonce,
    actor,
    purpose: SIGNED_REQUEST_PURPOSE,
    createdAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + ttlMs).toISOString(),
    consumedAt: new Date(nowMs).toISOString(),
  };

  const inserted = await store.putIfAbsent(key, record);
  if (!inserted) {
    throw new ApiError(409, "conflict", "The authentication nonce has already been used");
  }
}

export interface AuthenticateSignedRequestOptions {
  bodyText?: string;
  nowMs?: number;
  store?: NonceStore;
  environment?: Record<string, string | undefined>;
  resolvePublicKey?: (address: string) => string;
}

/**
 * Full STEALTH-AUTH-V1 verification sequence. Derives an authenticated
 * principal only after version, audience, timing, signature, and replay checks.
 */
export async function authenticateSignedRequest(
  request: Request,
  options: AuthenticateSignedRequestOptions = {},
): Promise<ApiPrincipal> {
  const env = options.environment ?? process.env;
  const addressRaw = requireHeader(request, "x-stealth-address");
  const parsedAddress = stellarAddressSchema.safeParse(addressRaw);
  if (!parsedAddress.success) {
    throw new ApiError(401, "unauthorized", "x-stealth-address must be a valid Stellar G-address");
  }
  const address = parsedAddress.data;

  const version = request.headers.get(VERSION_HEADER)?.trim() || SIGNED_REQUEST_VERSION;
  if (version !== SIGNED_REQUEST_VERSION) {
    throw new ApiError(401, "unauthorized", "Unsupported authentication version");
  }

  const signature = requireHeader(request, SIGNATURE_HEADER);
  const nonce = requireHeader(request, "x-stealth-nonce").toLowerCase();
  const timestamp = requireHeader(request, "x-stealth-timestamp");
  const audience = requireHeader(request, "x-stealth-audience");

  try {
    validateSignedRequestAudience(audience, {
      activeAudiences: getActiveAudiences(request, env),
    });
  } catch {
    throw new ApiError(401, "unauthorized", "Signed request audience is not accepted");
  }

  const nowMs = options.nowMs ?? Date.now();
  const challengeConfig = getAuthChallengeConfig(env);
  const timeStatus = signedRequestTimeStatus(
    timestamp,
    nowMs,
    challengeConfig.lifetimeMs,
    challengeConfig.clockSkewMs,
  );
  if (timeStatus === "invalid") {
    throw new ApiError(401, "unauthorized", "Invalid x-stealth-timestamp header");
  }
  if (timeStatus === "expired") {
    throw new ApiError("expired_challenge", { reason: AUTH_TIMING_REASONS.expired });
  }
  if (timeStatus === "future") {
    throw new ApiError("challenge_not_yet_valid", {
      reason: signedRequestTimingReason(timeStatus) ?? AUTH_TIMING_REASONS.notYetValid,
    });
  }

  const bodyText =
    options.bodyText ??
    (await request
      .clone()
      .text()
      .catch(() => {
        throw new ApiError(
          401,
          "unauthorized",
          "Unable to read request body for signature verification",
        );
      }));

  const headers = headersRecord(request);
  headers["x-stealth-address"] = address;
  headers["x-stealth-nonce"] = nonce;
  headers["x-stealth-timestamp"] = timestamp;
  headers["x-stealth-audience"] = audience;
  if (!headers.host) {
    throw new ApiError(401, "unauthorized", "Missing host header");
  }

  let canonical: string;
  try {
    canonical = canonicalizeSignedRequest({
      version: SIGNED_REQUEST_VERSION,
      method: request.method,
      url: request.url,
      headers,
      body: bodyText,
    });
  } catch {
    throw new ApiError(401, "unauthorized", "Unable to canonicalize signed request");
  }

  const publicKey = (options.resolvePublicKey ?? ((actor) => actor))(address);
  if (!verifyEd25519Signature(publicKey, canonical, signature)) {
    throw new ApiError(401, "unauthorized", "Signature verification failed");
  }

  await consumeSignedRequestNonce(address, nonce, {
    store: options.store ?? getSignedRequestNonceStore(),
    nowMs,
    environment: env,
  });

  const delegationHeader = request.headers.get("x-stealth-delegation");
  const metadata: Record<string, unknown> = {
    audience,
    nonce,
    authVersion: SIGNED_REQUEST_VERSION,
  };
  if (delegationHeader) {
    metadata.delegation = delegationHeader;
  }

  return {
    address,
    authMethod: delegationHeader ? "delegation+signed-request" : "signed-request",
    authenticatedAt: new Date(nowMs),
    metadata,
  };
}

/** Build signed STEALTH-AUTH-V1 headers for a Stellar keypair (tests/clients). */
export function buildSignedRequestHeaders(input: {
  keypair: Keypair;
  method: string;
  url: string;
  body?: string;
  audience?: string;
  nonce?: string;
  timestamp?: string;
  host?: string;
  extraHeaders?: Record<string, string>;
}): Record<string, string> {
  const body = input.body ?? "";
  const url = new URL(input.url);
  const host = input.host ?? url.host;
  const nonce = input.nonce ?? randomBytes(32).toString("hex");
  const timestamp = input.timestamp ?? new Date().toISOString();
  const audience = input.audience ?? "stealth.test";
  const address = input.keypair.publicKey();

  const headers: Record<string, string> = {
    host,
    "x-stealth-address": address,
    "x-stealth-nonce": nonce,
    "x-stealth-timestamp": timestamp,
    "x-stealth-audience": audience,
    ...(input.extraHeaders ?? {}),
  };

  const canonical = canonicalizeSignedRequest({
    version: SIGNED_REQUEST_VERSION,
    method: input.method,
    url: input.url,
    headers,
    body,
  });
  const signature = input.keypair.sign(Buffer.from(canonical, "utf8")).toString("base64");

  return {
    ...headers,
    [VERSION_HEADER]: SIGNED_REQUEST_VERSION,
    [SIGNATURE_HEADER]: signature,
  };
}
