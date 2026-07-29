import { createHash } from "node:crypto";

import {
  AUTH_TIMING_REASONS,
  DEFAULT_AUTH_CHALLENGE_LIFETIME_MS,
  DEFAULT_AUTH_CLOCK_SKEW_MS,
  getAuthChallengeConfig,
  type AuthTimingReason,
} from "./challenge";

export const SIGNED_REQUEST_VERSION = "STEALTH-AUTH-V1";

/**
 * Protocol defaults. Signed requests and challenges share one validity policy,
 * so these alias the challenge defaults rather than restating them; a
 * deployment overrides both at once through the environment configuration read
 * by {@link getAuthChallengeConfig}.
 */
export const SIGNED_REQUEST_MAX_AGE_MS = DEFAULT_AUTH_CHALLENGE_LIFETIME_MS;
export const SIGNED_REQUEST_CLOCK_SKEW_MS = DEFAULT_AUTH_CLOCK_SKEW_MS;

export const SIGNED_REQUEST_HEADERS = [
  "host",
  "x-stealth-address",
  "x-stealth-nonce",
  "x-stealth-timestamp",
] as const;

export interface SignedRequestInput {
  /** The explicit protocol version (e.g., "STEALTH-AUTH-V1") */
  version: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

function requiredHeader(headers: Record<string, string>, name: string): string {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  if (!entry || entry[1].trim() === "") throw new Error(`Missing required signed header: ${name}`);
  return entry[1].trim().replace(/[\t ]+/g, " ");
}

function canonicalQuery(url: URL): string {
  return [...url.searchParams.entries()]
    .map(([key, value]) => [encodeURIComponent(key), encodeURIComponent(value)] as const)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey),
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

/** Canonical wire representation signed by clients. */
export function canonicalizeSignedRequest(input: SignedRequestInput): string {
  const url = new URL(input.url);
  const path = url.pathname || "/";
  const target = `${path}${url.search ? `?${canonicalQuery(url)}` : ""}`;
  const signedHeaders = SIGNED_REQUEST_HEADERS.map(
    (name) => `${name}:${requiredHeader(input.headers, name)}`,
  ).join("\n");
  const bodyHash = createHash("sha256").update(input.body, "utf8").digest("hex");

  return [
    input.version,
    input.method.toUpperCase(),
    target,
    signedHeaders,
    SIGNED_REQUEST_HEADERS.join(";"),
    bodyHash,
  ].join("\n");
}

export type SignedRequestTimeStatus = "valid" | "expired" | "future" | "invalid";

/**
 * Checks the inclusive v1 request window against an injectable server clock.
 *
 * The window defaults to the deployment-configured challenge policy, so a
 * signed request and the challenge it carries are never judged against
 * different durations. Explicit arguments override it for tests and for
 * callers that already resolved the policy.
 */
export function signedRequestTimeStatus(
  timestamp: string,
  nowMs: number,
  maxAgeMs?: number,
  clockSkewMs?: number,
): SignedRequestTimeStatus {
  const configured = getAuthChallengeConfig();
  const lifetime = maxAgeMs ?? configured.lifetimeMs;
  const skew = clockSkewMs ?? configured.clockSkewMs;

  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs)) return "invalid";
  if (timestampMs - nowMs > skew) return "future";
  if (nowMs - timestampMs > lifetime + skew) return "expired";
  return "valid";
}

/**
 * Maps a time status to the stable machine-readable reason reported alongside
 * the API error code, or `null` when the status is not a timing failure.
 */
export function signedRequestTimingReason(
  status: SignedRequestTimeStatus,
): AuthTimingReason | null {
  switch (status) {
    case "expired":
      return AUTH_TIMING_REASONS.expired;
    case "future":
      return AUTH_TIMING_REASONS.notYetValid;
    default:
      return null;
  }
}
