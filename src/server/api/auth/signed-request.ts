import { createHash } from "node:crypto";

export const SIGNED_REQUEST_VERSION = "STEALTH-AUTH-V1";
export const SIGNED_REQUEST_MAX_AGE_MS = 5 * 60 * 1000;
export const SIGNED_REQUEST_CLOCK_SKEW_MS = 30 * 1000;

export const SIGNED_REQUEST_HEADERS = [
  "host",
  "x-stealth-address",
  "x-stealth-nonce",
  "x-stealth-timestamp",
] as const;

export interface SignedRequestInput {
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

/** Canonical wire representation signed by v1 clients. */
export function canonicalizeSignedRequest(input: SignedRequestInput): string {
  const url = new URL(input.url);
  const path = url.pathname || "/";
  const target = `${path}${url.search ? `?${canonicalQuery(url)}` : ""}`;
  const signedHeaders = SIGNED_REQUEST_HEADERS.map(
    (name) => `${name}:${requiredHeader(input.headers, name)}`,
  ).join("\n");
  const bodyHash = createHash("sha256").update(input.body, "utf8").digest("hex");

  return [
    SIGNED_REQUEST_VERSION,
    input.method.toUpperCase(),
    target,
    signedHeaders,
    SIGNED_REQUEST_HEADERS.join(";"),
    bodyHash,
  ].join("\n");
}

export type SignedRequestTimeStatus = "valid" | "expired" | "future" | "invalid";

/** Checks the inclusive v1 request window against an injectable server clock. */
export function signedRequestTimeStatus(
  timestamp: string,
  nowMs: number,
  maxAgeMs = SIGNED_REQUEST_MAX_AGE_MS,
  clockSkewMs = SIGNED_REQUEST_CLOCK_SKEW_MS,
): SignedRequestTimeStatus {
  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs)) return "invalid";
  if (timestampMs - nowMs > clockSkewMs) return "future";
  if (nowMs - timestampMs > maxAgeMs + clockSkewMs) return "expired";
  return "valid";
}
