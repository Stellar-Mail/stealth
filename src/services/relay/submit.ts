/**
 * Relay submission (BETA-046 / #1953).
 *
 * Submits the canonical signed relay request to the relay accept endpoint
 * (`POST /api/v1/relay/messages`), following the relay-auth-replay protocol:
 * the body is `{ messageId, sender, recipient, recipientDomain, payload }`
 * where `payload` is the JSON-serialized signed relay request — the envelope
 * payload extended with the four mandatory anti-replay fields
 * (`request_nonce`, `audience`, `idempotency_key`, `replay_window_seconds`)
 * and an Ed25519 signature over `jcs(payload)`.
 *
 * Idempotency / retry: the first attempt uses the caller's signed request. On
 * a transient failure (network error or 5xx) a fresh `request_nonce` is
 * generated and the request re-signed when a `resigner` is provided, while the
 * stable `idempotency_key` is preserved so the relay deduplicates. A 409
 * response (replayed nonce or already-completed idempotency key) is treated as
 * an idempotent success. Plaintext and keys never leave this module.
 */
import type { MessageDeliveryState } from "@/server/api/domain";
import {
  mapRelayStateToMessageDeliveryState,
  type DeliveryState,
  type ActionableErrorCode,
  type RelayNode,
} from "@/services/relay/federation";
import { canonicalizePayload, type EnvelopePayload } from "@/services/crypto/envelope";
import type { WalletSignature } from "@/services/stellar/wallet";

export type RelayResolver = (domain: string) => Promise<RelayNode | null>;

/** Body handed to a transport; the payload is the JSON-serialized signed request. */
export interface RelaySubmissionBody {
  messageId: string;
  sender: string;
  recipient: string;
  recipientDomain: string;
  payload: string;
  ttlMs?: number;
}

export type RelayTransport = (
  node: RelayNode,
  body: RelaySubmissionBody,
) => Promise<{ status: number; replayed?: boolean }>;

export interface RelaySubmitInput {
  messageId: string;
  sender: string;
  recipient: string;
  recipientDomain: string;
  /** JSON-serialized signed relay request used for the first attempt. */
  payload: string;
  ttlMs?: number;
  maxAttempts?: number;
  /**
   * Optional per-attempt re-signer. When provided, every retry rebuilds the
   * request with a fresh `request_nonce` (stable `idempotency_key`) and
   * re-signs, so transient failures never submit a replayable request.
   */
  resigner?: RelayRequestSigner;
}

/** Rebuilds and signs a canonical relay request for a single attempt. */
export interface RelayRequestSigner {
  /** Sealed envelope payload (anti-replay fields are added by the builder). */
  envelopePayload: EnvelopePayload;
  /** Authority id the request is bound to (prevents cross-relay replay). */
  audience: string;
  /** Stable per-message idempotency key (drives dedup across attempts). */
  idempotencyKey: string;
  /** Client-stated freshness window in seconds (clamped server-side). */
  replayWindowSeconds: number;
  /** Signs the canonical (JCS) serialization of the full payload. */
  sign: (canonicalPayload: string) => Promise<WalletSignature>;
}

export interface RelaySubmitResult {
  state: DeliveryState;
  messageDeliveryState: MessageDeliveryState;
  attempts: number;
  errorCode?: ActionableErrorCode;
  delivered: boolean;
}

export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_REPLAY_WINDOW_SECONDS = 300;
export const DEFAULT_RELAY_AUDIENCE = "relay:stealth.test";

const GCM_NONCE_BYTES = 16;

/** Fresh anti-replay nonce: 16 random bytes as lowercase hex. */
export function generateRequestNonce(): string {
  const bytes = new Uint8Array(GCM_NONCE_BYTES);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}

/** The relay request payload shape expected by the accept endpoint. */
export interface RelayRequestPayload extends EnvelopePayload {
  request_nonce: string;
  audience: string;
  idempotency_key: string;
  replay_window_seconds: number;
}

/** The canonical signed relay request submitted to the relay. */
export interface SignedRelayRequest {
  payload: RelayRequestPayload;
  signature: { scheme: "Ed25519"; value: string };
}

/**
 * Build and sign one canonical relay request. The signature covers the JCS
 * serialization of the envelope payload PLUS the four anti-replay fields, so
 * none of them can be stripped or altered without invalidating the signature.
 */
export async function buildSignedRelayRequest(
  signer: RelayRequestSigner,
  nonce: string = generateRequestNonce(),
): Promise<SignedRelayRequest> {
  const payload: RelayRequestPayload = {
    ...signer.envelopePayload,
    request_nonce: nonce,
    audience: signer.audience,
    idempotency_key: signer.idempotencyKey,
    replay_window_seconds: signer.replayWindowSeconds,
  };
  const canonical = canonicalizePayload(payload);
  const signature = await signer.sign(canonical);
  return {
    payload,
    signature: { scheme: "Ed25519", value: signature.value },
  };
}

/** Default relay resolution: diagnostics endpoint, falling back to the accept route. */
async function resolveRelayViaDiagnostics(domain: string): Promise<RelayNode | null> {
  try {
    const response = await fetch(`/relays/${encodeURIComponent(domain)}/diagnostics`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = (await response.json().catch(() => ({}))) as {
      endpoint?: string;
      publicKey?: string;
    };
    return {
      domain,
      endpoint: data.endpoint ?? `/api/v1/relay/messages`,
      publicKey: data.publicKey ?? "",
    };
  } catch {
    return null;
  }
}

/** Real transport: POST the canonical request to the relay accept endpoint. */
export const defaultRelayTransport: RelayTransport = async (node, body) => {
  const response = await fetch(node.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-stealth-address": body.sender,
    },
    body: JSON.stringify({
      messageId: body.messageId,
      sender: body.sender,
      recipient: body.recipient,
      recipientDomain: body.recipientDomain,
      payload: body.payload,
      ...(body.ttlMs !== undefined ? { ttlMs: body.ttlMs } : {}),
    }),
  });
  return {
    status: response.status,
    replayed: response.headers.get("x-idempotency-replayed") === "true",
  };
};

function backoffMs(attempt: number): number {
  return Math.min(2 ** (attempt - 1) * 250, 2_000);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function relaySubmitResult(
  state: DeliveryState,
  attempts: number,
  delivered: boolean,
  errorCode?: ActionableErrorCode,
): RelaySubmitResult {
  return {
    state,
    messageDeliveryState: mapRelayStateToMessageDeliveryState(state, errorCode),
    attempts,
    ...(errorCode ? { errorCode } : {}),
    delivered,
  };
}

/**
 * Submit a canonical relay request to the relay with bounded retries.
 *
 * State mapping: 2xx → ACKNOWLEDGED, 409 → DEDUPLICATED (idempotent success),
 * 4xx → DEAD_LETTER with an actionable code, network errors / 5xx → bounded
 * retry with a freshly signed request (fresh nonce, stable idempotency key).
 */
export async function submitToRelay(
  input: RelaySubmitInput,
  options: { resolveRelay?: RelayResolver; transport?: RelayTransport } = {},
): Promise<RelaySubmitResult> {
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const resolveRelay = options.resolveRelay ?? resolveRelayViaDiagnostics;
  const transport = options.transport ?? defaultRelayTransport;

  const node = await resolveRelay(input.recipientDomain);
  if (!node) {
    return relaySubmitResult("DEAD_LETTER", 0, false, "ERR_DOMAIN_NOT_FOUND");
  }

  let payload = input.payload;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await transport(node, {
        messageId: input.messageId,
        sender: input.sender,
        recipient: input.recipient,
        recipientDomain: input.recipientDomain,
        payload,
        ttlMs: input.ttlMs,
      });

      if (response.status >= 200 && response.status < 300) {
        return relaySubmitResult("ACKNOWLEDGED", attempt, true);
      }
      if (response.status === 409) {
        return relaySubmitResult("DEDUPLICATED", attempt, true);
      }
      if (response.status >= 400 && response.status < 500) {
        const code: ActionableErrorCode =
          response.status === 401 || response.status === 403
            ? "ERR_UNAUTHORIZED"
            : "ERR_PAYLOAD_REJECTED";
        return relaySubmitResult("DEAD_LETTER", attempt, false, code);
      }
      // Transient 5xx: fall through to re-sign + retry.
    } catch {
      // Network error: fall through to re-sign + retry.
    }

    if (input.resigner) {
      const fresh = await buildSignedRelayRequest(input.resigner);
      payload = JSON.stringify(fresh);
    }
    if (attempt < maxAttempts) {
      await delay(backoffMs(attempt));
    }
  }

  return relaySubmitResult("DEAD_LETTER", maxAttempts, false, "ERR_DELIVERY_EXPIRED");
}
