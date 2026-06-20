import Fastify from "fastify";
import { verifySignature } from "./signer.js";

export function createServer({ replayWindowMs = 2 * 60 * 1000, skewMs = 30 * 1000 } = {}) {
  const fastify = Fastify({ logger: false });

  // In-memory stores for demo. Production should use Redis/DB.
  const nonceStore = new Map(); // key: `${kid}:${nonce}` -> timestamp
  const idempotencyStore = new Map(); // key: `${kid}:${idempotency_key}` -> { status, body, timestamp }

  function now() {
    return Date.now();
  }

  fastify.post("/relay", async (req, reply) => {
    try {
      const envelope = req.body;
      const { payload, signature, kid, alg, pub } = envelope;
      if (!payload || !signature || !kid) {
        reply
          .code(400)
          .send({ error: "invalid_request", error_description: "missing envelope fields" });
        return;
      }

      // For test harness, accept `pub` field with raw public key bytes (base64url)
      if (!pub) {
        reply.code(401).send({ error: "unknown_kid", error_description: "no public key provided" });
        return;
      }

      const pubKey = Buffer.from(pub, "base64url");
      const verified = verifySignature(pubKey, payload, signature);
      if (!verified) {
        reply
          .code(401)
          .send({ error: "invalid_signature", error_description: "signature verification failed" });
        return;
      }

      const createdAt = Date.parse(payload.created_at);
      if (isNaN(createdAt)) {
        reply.code(400).send({ error: "invalid_timestamp", error_description: "bad created_at" });
        return;
      }

      const nowMs = now();
      if (createdAt - nowMs > skewMs) {
        reply
          .code(400)
          .send({ error: "invalid_timestamp", error_description: "created_at in future" });
        return;
      }

      if (nowMs - createdAt > replayWindowMs + skewMs) {
        reply.code(400).send({ error: "replay_detected", error_description: "request too old" });
        return;
      }

      const nonceKey = `${kid}:${payload.nonce}`;
      if (nonceStore.has(nonceKey)) {
        reply.code(409).send({ error: "nonce_replay", error_description: "nonce already seen" });
        return;
      }

      // Insert nonce with TTL via cleanup strategy
      nonceStore.set(nonceKey, nowMs);

      // handle idempotency
      if (payload.idempotency_key) {
        const idKey = `${kid}:${payload.idempotency_key}`;
        if (idempotencyStore.has(idKey)) {
          const prev = idempotencyStore.get(idKey);
          reply.header("X-Idempotency-Replayed", "true");
          reply.code(prev.status).send(prev.body);
          return;
        }
        // process and store
        const response = { result: "ok", echoed: payload.body_hash || null };
        idempotencyStore.set(idKey, { status: 200, body: response, timestamp: nowMs });
        reply.code(200).send(response);
        return;
      }

      // default processing
      reply.code(200).send({ result: "ok" });
    } catch (err) {
      reply.code(500).send({ error: "server_error", error_description: String(err) });
    }
  });

  // background cleanup for stores
  setInterval(() => {
    const cutoff = Date.now() - (replayWindowMs + 60 * 1000);
    for (const [k, t] of nonceStore) {
      if (t < cutoff) nonceStore.delete(k);
    }
    const idemCutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [k, v] of idempotencyStore) {
      if (v.timestamp < idemCutoff) idempotencyStore.delete(k);
    }
  }, 30 * 1000).unref();

  return fastify;
}
