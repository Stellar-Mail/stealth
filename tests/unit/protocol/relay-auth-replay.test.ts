/**
 * Conformance tests for relay request authentication and replay protection
 * (issue #59). Drives protocol/vectors/relay-auth-replay.json through the
 * reference verifier in src/services/crypto/relayAuth.ts.
 *
 * Uses Node's built-in ed25519 so verification is real, not mocked. The test
 * keypair is fixed for determinism. Time is injected so STALE/FUTURE cases are
 * reproducible.
 */
import { describe, expect, it } from "vitest";
import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

import {
  verifyRelayRequest,
  RelayAuthError,
  type RelayAuthConfig,
  type RelayRequest,
} from "../../../src/services/crypto/relayAuth";
import { canonicalizePayload } from "../../../src/services/crypto/envelope";
import vectors from "../../../protocol/vectors/relay-auth-replay.json";

// Fixed ed25519 keypair (DER) for deterministic signing in tests.
const PRIV_DER =
  "302e020100300506032b6570042204207a08dbb372ef48aaba159e65964528b6e82c2971ec14fec43a6d5b139962a582";
const PUB_DER =
  "302a300506032b6570032100a01bcbe720d8344a40b29b5a447fd57d2dd2ce02209a0c581c7bcf9b9706bcf8";
const SENDER = "a01bcbe720d8344a40b29b5a447fd57d2dd2ce02209a0c581c7bcf9b9706bcf8";

const privKey = createPrivateKey({
  key: Buffer.from(PRIV_DER, "hex"),
  format: "der",
  type: "pkcs8",
});
const pubKey = createPublicKey({
  key: Buffer.from(PUB_DER, "hex"),
  format: "der",
  type: "spki",
});

/** Sign the canonical (JCS) payload — must match what verifyRelayRequest checks. */
function signCanonical(payload: unknown): string {
  const msg = Buffer.from(canonicalizePayload(payload));
  return sign(null, msg, privKey).toString("hex");
}

/** In-memory nonce + idempotency store that resets per case. */
function makeStore() {
  const nonces = new Set<string>();
  const idemp = new Map<string, unknown>();
  return {
    isNonceSeen: (n: string) => nonces.has(n),
    markNonceSeen: (n: string) => void nonces.add(n),
    getIdempotencyResult: (k: string) => (idemp.has(k) ? idemp.get(k) : null),
    storeIdempotencyResult: (k: string, r: unknown) => void idemp.set(k, r),
  };
}

function buildConfig(nowSeconds: number, store: ReturnType<typeof makeStore>): RelayAuthConfig {
  return {
    audience: "relay:test.stealth",
    verify: ({ publicKey, message, signature }) => {
      // message is the canonical JSON string; signature is hex.
      const sig = Buffer.from(signature, "hex");
      const msg = Buffer.from(message);
      const key = createPublicKey({
        key: Buffer.from(publicKey, "hex"),
        format: "der",
        type: "spki",
      });
      return verify(null, msg, key, sig);
    },
    resolvePublicKey: (sender: string) => (sender === SENDER ? PUB_DER : null),
    ...store,
    nowSeconds: () => nowSeconds,
  };
}

const NOW_SECONDS = 1_700_000_000;
const NOW_ISO = new Date(NOW_SECONDS * 1000).toISOString();

describe("relay auth + replay protection (#59)", () => {
  for (const c of vectors.cases as any[]) {
    it(c.id, () => {
      const store = makeStore();
      const config = buildConfig(NOW_SECONDS, store);

      // Build payload from base + overrides.
      const payload: Record<string, unknown> = { ...vectors.base };
      if (c.overrides) {
        for (const [k, v] of Object.entries(c.overrides)) {
          if (v === null) delete payload[k];
          else payload[k] = v;
        }
      }
      // Timestamp handling.
      if (payload.timestamp === "NOW") payload.timestamp = NOW_ISO;
      else if (payload.timestamp === "STALE")
        payload.timestamp = new Date((NOW_SECONDS - 600) * 1000).toISOString();
      else if (payload.timestamp === "FUTURE")
        payload.timestamp = new Date((NOW_SECONDS + 600) * 1000).toISOString();

      // Preseed store (duplicate nonce / idempotent replay).
      if (c.preseed?.nonce) store.markNonceSeen(c.preseed.nonce);
      if (c.preseed?.idempotency !== undefined) {
        store.storeIdempotencyResult(
          c.preseed.idempotencyKey ?? "idem-idem-000000000",
          c.preseed.idempotency,
        );
      }

      const signingKey = c.expected.useWrongKey
        ? createPrivateKey({
            key: Buffer.from(
              "302e020100300506032b6570042204200000000000000000000000000000000000000000000000000000000000000001",
              "hex",
            ),
            format: "der",
            type: "pkcs8",
          })
        : privKey;

      const sig = sign(null, Buffer.from(canonicalizePayload(payload)), signingKey).toString("hex");

      // Tamper AFTER signing (mutate nonce; canonicalization must invalidate sig).
      if (c.tamper === "nonce") {
        payload.request_nonce = "nonce-tampered-after-sign";
      }

      const request: RelayRequest = {
        payload: payload as any,
        signature: { scheme: "Ed25519", value: sig },
      };

      if (c.expected.ok) {
        const result = verifyRelayRequest(request, config);
        expect(result.ok).toBe(true);
        if (c.expected.idempotencyReplayed !== undefined) {
          expect(result.idempotencyReplayed).toBe(c.expected.idempotencyReplayed);
        }
      } else {
        let thrown: unknown;
        try {
          verifyRelayRequest(request, config);
        } catch (err) {
          thrown = err;
        }
        expect(thrown).toBeInstanceOf(RelayAuthError);
        expect((thrown as RelayAuthError).code).toBe(c.expected.error);
      }
    });
  }
});
