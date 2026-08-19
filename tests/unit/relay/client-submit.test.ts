/**
 * Relay client submission (BETA-046 / #1953). Verifies `submitToRelay` maps
 * relay responses and transient failures to the canonical delivery states,
 * retries with a freshly signed request (fresh nonce, stable idempotency key),
 * and never resubmits a replayable request after a network error.
 */
import { describe, expect, it, vi } from "vitest";
import {
  submitToRelay,
  buildSignedRelayRequest,
  generateRequestNonce,
  type RelayTransport,
  type RelayRequestSigner,
} from "../../../src/services/relay/submit";
import type { RelayNode } from "../../../src/services/relay/federation";

const NODE: RelayNode = {
  domain: "stellar.org",
  endpoint: "/api/v1/relay/messages",
  publicKey: "",
};

const BASE = {
  messageId: "msg-1",
  sender: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  recipient: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  recipientDomain: "stellar.org",
  payload: JSON.stringify({ stub: true }),
};

function transportReturning(status: number, replayed = false): RelayTransport {
  return async () => ({ status, replayed });
}

function recordingSigner(): {
  signer: RelayRequestSigner;
  canonicalSeen: string[];
} {
  const canonicalSeen: string[] = [];
  const signer: RelayRequestSigner = {
    envelopePayload: {
      version: "v1",
      sender: BASE.sender,
      recipient: BASE.recipient,
      timestamp: "2026-08-17T00:00:00.000Z",
      encryption_metadata: {
        algorithm: "AES-256-GCM",
        nonce: "00",
        mac: "00",
      },
      content_commitment: "v1:sha256:hex:" + "a".repeat(64),
      attachments: [],
    },
    audience: "relay:stealth.test",
    idempotencyKey: `idem-${BASE.messageId}`,
    replayWindowSeconds: 300,
    sign: async (canonical: string) => {
      canonicalSeen.push(canonical);
      return { scheme: "Ed25519", signerAddress: BASE.sender, value: "00".repeat(64) };
    },
  };
  return { signer, canonicalSeen };
}

describe("relay client submit (#1953)", () => {
  it("returns ACKNOWLEDGED when the relay accepts once", async () => {
    const result = await submitToRelay(BASE, {
      resolveRelay: async () => NODE,
      transport: transportReturning(200),
    });
    expect(result.state).toBe("ACKNOWLEDGED");
    expect(result.delivered).toBe(true);
    expect(result.attempts).toBe(1);
  });

  it("treats a 409 (replayed/deduplicated) as an idempotent success", async () => {
    const result = await submitToRelay(BASE, {
      resolveRelay: async () => NODE,
      transport: transportReturning(409, true),
    });
    expect(result.state).toBe("DEDUPLICATED");
    expect(result.delivered).toBe(true);
  });

  it("maps 4xx to DEAD_LETTER with an actionable code", async () => {
    const rejected = await submitToRelay(BASE, {
      resolveRelay: async () => NODE,
      transport: transportReturning(400),
    });
    expect(rejected.state).toBe("DEAD_LETTER");
    expect(rejected.errorCode).toBe("ERR_PAYLOAD_REJECTED");
    expect(rejected.delivered).toBe(false);

    const unauthorized = await submitToRelay(BASE, {
      resolveRelay: async () => NODE,
      transport: transportReturning(401),
    });
    expect(unauthorized.errorCode).toBe("ERR_UNAUTHORIZED");
  });

  it("retries transient 5xx with a fresh request_nonce", async () => {
    const { signer } = recordingSigner();
    const initial = await buildSignedRelayRequest(signer);
    const initialNonce = initial.payload.request_nonce;
    const noncesSeen: string[] = [];
    let calls = 0;
    const transport: RelayTransport = async (_node, body) => {
      calls += 1;
      const parsed = JSON.parse(body.payload) as { payload?: { request_nonce?: string } };
      if (parsed.payload?.request_nonce) noncesSeen.push(parsed.payload.request_nonce);
      return calls === 1 ? { status: 500 } : { status: 200 };
    };

    const result = await submitToRelay(
      { ...BASE, payload: JSON.stringify(initial), resigner: signer },
      { resolveRelay: async () => NODE, transport },
    );

    expect(result.state).toBe("ACKNOWLEDGED");
    expect(result.attempts).toBe(2);
    expect(noncesSeen).toHaveLength(2);
    expect(noncesSeen[0]).toBe(initialNonce);
    expect(noncesSeen[1]).not.toBe(initialNonce);
  });

  it("retries after a network error and succeeds on the next attempt", async () => {
    const { signer } = recordingSigner();
    let calls = 0;
    const transport: RelayTransport = async () => {
      calls += 1;
      if (calls === 1) throw new Error("network down");
      return { status: 200 };
    };

    const result = await submitToRelay(
      { ...BASE, resigner: signer },
      { resolveRelay: async () => NODE, transport },
    );
    expect(result.state).toBe("ACKNOWLEDGED");
    expect(result.attempts).toBe(2);
  });

  it("fails to DEAD_LETTER after exhausting transient retries", async () => {
    const { signer } = recordingSigner();
    const result = await submitToRelay(
      { ...BASE, resigner: signer, maxAttempts: 2 },
      { resolveRelay: async () => NODE, transport: transportReturning(503) },
    );
    expect(result.state).toBe("DEAD_LETTER");
    expect(result.errorCode).toBe("ERR_DELIVERY_EXPIRED");
    expect(result.attempts).toBe(2);
    expect(result.delivered).toBe(false);
  });

  it("returns ERR_DOMAIN_NOT_FOUND when no relay node resolves", async () => {
    const result = await submitToRelay(BASE, {
      resolveRelay: async () => null,
      transport: vi.fn() as unknown as RelayTransport,
    });
    expect(result.state).toBe("DEAD_LETTER");
    expect(result.errorCode).toBe("ERR_DOMAIN_NOT_FOUND");
    expect(result.attempts).toBe(0);
  });

  it("builds a signed request with the four mandatory anti-replay fields", async () => {
    const { signer } = recordingSigner();
    const signed = await buildSignedRelayRequest(signer);
    expect(signed.signature.scheme).toBe("Ed25519");
    expect(typeof signed.signature.value).toBe("string");
    expect(signed.payload.request_nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(signed.payload.audience).toBe("relay:stealth.test");
    expect(signed.payload.idempotency_key).toBe(`idem-${BASE.messageId}`);
    expect(signed.payload.replay_window_seconds).toBe(300);
  });

  it("generates unique request nonces per attempt", () => {
    expect(generateRequestNonce()).toMatch(/^[0-9a-f]{32}$/);
    const seen = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      seen.add(generateRequestNonce());
    }
    expect(seen.size).toBe(50);
  });
});
