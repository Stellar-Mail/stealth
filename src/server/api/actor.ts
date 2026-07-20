import { Buffer } from "buffer";
import { Keypair } from "@stellar/stellar-sdk";

import { stellarAddressSchema } from "./domain";
import { ApiError } from "./errors";

export const ACTOR_HEADER = "x-stealth-address";
export const ACTOR_NONCE_HEADER = "x-stealth-nonce";
export const ACTOR_SIGNATURE_HEADER = "x-stealth-signature";
export const ACTOR_TIMESTAMP_HEADER = "x-stealth-timestamp";

const AUTH_DOMAIN = "stealth-mail-api-request-v1";
const DEFAULT_MAX_CLOCK_SKEW_SECONDS = 5 * 60;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

const consumedNonces = new Map<string, number>();

function unauthorized(message: string): never {
  throw new ApiError(401, "unauthorized", message);
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function decodeBase64(value: string) {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    unauthorized(`${ACTOR_SIGNATURE_HEADER} must be valid base64`);
  }
}

async function bodyHash(request: Request) {
  const body = await request.clone().arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", body);
  return bytesToHex(new Uint8Array(digest));
}

export async function buildActorSignaturePayload(
  request: Request,
  actor: string,
  timestamp: string,
  nonce: string,
) {
  const url = new URL(request.url);
  const target = `${url.pathname}${url.search}`;

  return new TextEncoder().encode(
    [
      AUTH_DOMAIN,
      actor,
      timestamp,
      nonce,
      request.method.toUpperCase(),
      target,
      await bodyHash(request),
    ].join("\n"),
  );
}

function consumeNonce(actor: string, nonce: string, nowSeconds: number, expiresAt: number) {
  for (const [key, expiry] of consumedNonces) {
    if (expiry < nowSeconds) consumedNonces.delete(key);
  }

  const key = `${actor}:${nonce}`;
  if (consumedNonces.has(key)) {
    unauthorized("The signed request nonce has already been used");
  }
  consumedNonces.set(key, expiresAt);
}

export async function requireActor(
  request: Request,
  options: { maxClockSkewSeconds?: number; now?: Date } = {},
) {
  const actorValue = request.headers.get(ACTOR_HEADER);
  const nonce = request.headers.get(ACTOR_NONCE_HEADER);
  const signatureValue = request.headers.get(ACTOR_SIGNATURE_HEADER);
  const timestampValue = request.headers.get(ACTOR_TIMESTAMP_HEADER);

  if (!actorValue || !nonce || !signatureValue || !timestampValue) {
    unauthorized("Signed actor headers are required");
  }

  const actorResult = stellarAddressSchema.safeParse(actorValue);
  if (!actorResult.success) {
    unauthorized(`${ACTOR_HEADER} must be a valid Stellar G-address`);
  }
  if (!NONCE_PATTERN.test(nonce)) {
    unauthorized(`${ACTOR_NONCE_HEADER} must be a 16-128 character URL-safe value`);
  }

  const timestamp = Number(timestampValue);
  if (!Number.isSafeInteger(timestamp)) {
    unauthorized(`${ACTOR_TIMESTAMP_HEADER} must be a Unix timestamp in seconds`);
  }

  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const maxClockSkew = options.maxClockSkewSeconds ?? DEFAULT_MAX_CLOCK_SKEW_SECONDS;
  if (Math.abs(nowSeconds - timestamp) > maxClockSkew) {
    unauthorized("The signed request timestamp is outside the accepted window");
  }

  const signature = decodeBase64(signatureValue);
  if (signature.length !== 64) {
    unauthorized(`${ACTOR_SIGNATURE_HEADER} must contain a 64-byte Ed25519 signature`);
  }

  const payload = await buildActorSignaturePayload(
    request,
    actorResult.data,
    timestampValue,
    nonce,
  );
  let verified = false;
  try {
    verified = Keypair.fromPublicKey(actorResult.data).verify(
      Buffer.from(payload),
      Buffer.from(signature),
    );
  } catch {
    unauthorized(`${ACTOR_HEADER} must contain a valid Stellar public key`);
  }
  if (!verified) {
    unauthorized("The signed request could not be verified");
  }

  consumeNonce(actorResult.data, nonce, nowSeconds, timestamp + maxClockSkew);
  return actorResult.data;
}

export function assertActorMatches(actor: string, expectedAddress: string) {
  if (actor !== expectedAddress) {
    throw new ApiError(403, "forbidden", "The authenticated actor cannot modify this resource");
  }
  return actor;
}

export function resetActorReplayCache() {
  consumedNonces.clear();
}
