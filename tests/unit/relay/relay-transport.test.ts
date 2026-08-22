import { describe, expect, it } from "vitest";
import { createPrivateKey, sign } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import { canonicalizePayload } from "../../../src/services/crypto/envelope";
import { canonicalizeSignedRequest } from "../../../src/server/api/auth/signed-request";

import { MemoryRelayPersistence } from "../../../src/services/relay/memory-persistence";
import { InProcessRelayWorker } from "../../../src/services/relay/in-process-worker";
import { RelayService, type RelayServiceConfig } from "../../../src/services/relay/relay-service";
import type { RelayAdmissionEvaluator } from "../../../src/services/relay/policy-admission";
import {
  handleRelayHealth,
  handleRelayReadiness,
  handleRelaySubmit,
  handleRelayVersion,
} from "../../../src/services/relay/transport";

const sender = `G${"A".repeat(55)}`;
const recipient = `G${"B".repeat(55)}`;
const otherActor = `G${"C".repeat(55)}`;
const messageId = "d".repeat(64);

function makeConfig(overrides: Partial<RelayServiceConfig> = {}): RelayServiceConfig {
  return {
    serviceName: "stealth-relay",
    version: "test-build",
    apiVersion: "v1",
    protocolVersion: "v1",
    timeoutMs: 1_000,
    network: {
      horizonUrl: "https://horizon-testnet.stellar.org",
      sorobanRpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
    ...overrides,
  };
}

function allowAllEvaluator(): RelayAdmissionEvaluator {
  return {
    async evaluate() {
      return {
        policyVersion: 1,
        allowed: true,
        kind: "trusted",
        reason: "sender_allowed",
        rule: "allow",
        requiredPostage: "0",
        source: "offchain_fallback",
        evaluatedAt: "2026-01-01T00:00:00.000Z",
      };
    },
  };
}

function makeService(config: RelayServiceConfig = makeConfig()) {
  const persistence = new MemoryRelayPersistence();
  const worker = new InProcessRelayWorker(persistence);
  return new RelayService(persistence, worker, config, { evaluator: allowAllEvaluator() });
}

function getRequest(path = "/api/v1/relay/health") {
  return new Request(`https://stealth.test${path}`, { method: "GET" });
}

function submitRequest(actor: string, body: Record<string, unknown> | string) {
  return new Request("https://stealth.test/api/v1/relay/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-stealth-address": actor,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function validBody() {
  return {
    messageId,
    sender,
    recipient,
    recipientDomain: "example.com",
    payload: "aGVsbG8=",
  };
}

describe("relay health endpoint", () => {
  it("returns 200 ok with pinned fields and no secrets", async () => {
    const response = await handleRelayHealth(getRequest(), makeService());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual({
      status: "ok",
      service: "stealth-relay",
      version: "test-build",
      time: expect.any(String),
    });
    expect(Object.keys(body.data).sort()).toEqual(["service", "status", "time", "version"]);
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(JSON.stringify(body)).not.toContain("Test SDF Network ; September 2015");
  });
});

describe("relay readiness endpoint", () => {
  it("returns 200 when the relay is ready", async () => {
    const response = await handleRelayReadiness(
      getRequest("/api/v1/relay/readiness"),
      makeService(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        ready: true,
        dependencies: { storage: "ok", queue: "ok", network: "ok" },
      },
    });
  });

  it("returns 503 when a dependency is unavailable", async () => {
    const service = makeService(
      makeConfig({
        network: {
          horizonUrl: "not-a-url",
          sorobanRpcUrl: "",
          networkPassphrase: "",
        },
      }),
    );
    const response = await handleRelayReadiness(getRequest("/api/v1/relay/readiness"), service);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      data: { ready: false },
    });
  });
});

describe("relay version endpoint", () => {
  it("returns 200 with the pinned version contract", async () => {
    const response = await handleRelayVersion(getRequest("/api/v1/relay/version"), makeService());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        app: "stealth-relay",
        apiVersion: "v1",
        protocolVersion: "v1",
        build: "test-build",
      },
    });
  });
});

describe("relay message submission endpoint", () => {
  it("returns 401 when the actor header is missing", async () => {
    const request = new Request("https://stealth.test/api/v1/relay/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody()),
    });
    const response = await handleRelaySubmit(request, makeService());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "unauthorized" },
    });
  });

  it("returns 401 when the actor header is not a Stellar address", async () => {
    const request = submitRequest("not-an-address", validBody());
    const response = await handleRelaySubmit(request, makeService());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "unauthorized" },
    });
  });

  it("returns 403 when the actor does not match the submitted sender", async () => {
    const request = submitRequest(otherActor, validBody());
    const response = await handleRelaySubmit(request, makeService());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "forbidden" },
    });
  });

  it("returns 202 and accepts a valid submission", async () => {
    const request = submitRequest(sender, validBody());
    const response = await handleRelaySubmit(request, makeService());

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        accepted: true,
        messageId,
        queueDepth: 1,
        service: "stealth-relay",
        replayed: false,
        admission: {
          allowed: true,
          kind: "trusted",
          reason: "sender_allowed",
          policyVersion: 1,
          requiredPostage: "0",
        },
      },
    });
  });

  it("returns 422 for an invalid payload shape", async () => {
    const request = submitRequest(sender, { messageId: "not-a-hash" });
    const response = await handleRelaySubmit(request, makeService());

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "validation_error" },
    });
  });

  it("returns 413 when the body exceeds the relay body limit", async () => {
    const oversized = JSON.stringify({
      ...validBody(),
      payload: "x".repeat(2 * 1024 * 1024),
    });
    const request = submitRequest(sender, oversized);
    const response = await handleRelaySubmit(request, makeService());

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "bad_request" },
    });
  });

  it("returns 503 when the relay is not ready", async () => {
    const service = makeService(
      makeConfig({
        network: {
          horizonUrl: "not-a-url",
          sorobanRpcUrl: "",
          networkPassphrase: "",
        },
      }),
    );
    const request = submitRequest(sender, validBody());
    const response = await handleRelaySubmit(request, service);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "dependency_unavailable" },
    });
  });
});

describe("relay auth & anti-replay security boundary", () => {
  const NOW_SECONDS = 1_700_000_000;
  const testKeypair = Keypair.random();
  const testSender = testKeypair.publicKey();

  function makeRelayService(nowSec = NOW_SECONDS) {
    const config = makeConfig({
      audience: "relay:stealth.test",
      nowSeconds: () => nowSec,
    });
    return makeService(config);
  }

  function makeSignedRelayPayload(
    overrides: Record<string, unknown> = {},
    customKeypair = testKeypair,
  ) {
    const payload = {
      version: "v1",
      sender: testSender,
      recipient: recipient,
      timestamp: new Date(NOW_SECONDS * 1000).toISOString(),
      encryption_metadata: { algorithm: "AES-256-GCM", nonce: "00", mac: "00" },
      content_commitment: messageId,
      attachments: [],
      request_nonce: "nonce-test-123456789012345",
      audience: "relay:stealth.test",
      idempotency_key: "idem-test-123456789012345",
      replay_window_seconds: 300,
      ...overrides,
    };
    const canonical = canonicalizePayload(payload);
    const sig = customKeypair.sign(Buffer.from(canonical)).toString("hex");
    return { payload, signature: { scheme: "Ed25519", value: sig } };
  }

  function submitRelayPayloadRequest(container: Record<string, unknown>, actor = testSender) {
    const payloadStr = JSON.stringify(container);
    return new Request("https://stealth.test/api/v1/relay/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-stealth-address": actor,
      },
      body: JSON.stringify({
        messageId,
        sender: actor,
        recipient,
        recipientDomain: "example.com",
        payload: payloadStr,
      }),
    });
  }

  it("accepts a valid signed relay request payload once and returns 202", async () => {
    const service = makeRelayService();
    const container = makeSignedRelayPayload();
    const request = submitRelayPayloadRequest(container);

    const response = await handleRelaySubmit(request, service);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      data: { accepted: true, messageId },
    });
  });

  it("rejects a replayed submission (same request_nonce) before storage with 409", async () => {
    const service = makeRelayService();
    const container = makeSignedRelayPayload();

    const req1 = submitRelayPayloadRequest(container);
    const res1 = await handleRelaySubmit(req1, service);
    expect(res1.status).toBe(202);

    const req2 = submitRelayPayloadRequest(container);
    const res2 = await handleRelaySubmit(req2, service);
    expect(res2.status).toBe(409);
    await expect(res2.json()).resolves.toMatchObject({
      error: {
        code: "conflict",
        message: expect.stringContaining("REPLAY_DETECTED"),
      },
    });
  });

  it("rejects a submission with tampered body or invalid signature with 401", async () => {
    const service = makeRelayService();
    const container = makeSignedRelayPayload();
    // Tamper nonce after signing
    (container.payload as any).request_nonce = "nonce-tampered-123456789";

    const request = submitRelayPayloadRequest(container);
    const response = await handleRelaySubmit(request, service);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "unauthorized",
        message: expect.stringContaining("INVALID_SIGNATURE"),
      },
    });
  });

  it("rejects a stale submission older than replay window with 400", async () => {
    const service = makeRelayService(NOW_SECONDS);
    const container = makeSignedRelayPayload({
      timestamp: new Date((NOW_SECONDS - 600) * 1000).toISOString(),
    });

    const request = submitRelayPayloadRequest(container);
    const response = await handleRelaySubmit(request, service);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "bad_request",
        message: expect.stringContaining("STALE_REQUEST"),
      },
    });
  });

  it("rejects a future submission beyond clock skew tolerance with 400", async () => {
    const service = makeRelayService(NOW_SECONDS);
    const container = makeSignedRelayPayload({
      timestamp: new Date((NOW_SECONDS + 600) * 1000).toISOString(),
    });

    const request = submitRelayPayloadRequest(container);
    const response = await handleRelaySubmit(request, service);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "bad_request",
        message: expect.stringContaining("FUTURE_REQUEST"),
      },
    });
  });

  it("rejects a submission with audience mismatch with 403", async () => {
    const service = makeRelayService(NOW_SECONDS);
    const container = makeSignedRelayPayload({
      audience: "relay:other.stealth",
    });

    const request = submitRelayPayloadRequest(container);
    const response = await handleRelaySubmit(request, service);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "forbidden",
        message: expect.stringContaining("AUDIENCE_MISMATCH"),
      },
    });
  });

  it("allows concurrent identical nonces to produce exactly 1 accepted request and reject the rest with 409", async () => {
    const service = makeRelayService();
    const container = makeSignedRelayPayload();

    const requests = Array.from({ length: 10 }, () =>
      handleRelaySubmit(submitRelayPayloadRequest(container), service),
    );

    const responses = await Promise.all(requests);
    const statuses = responses.map((r) => r.status);

    expect(statuses.filter((s) => s === 202)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
  });

  describe("HTTP signed request headers boundary", () => {
    function submitSignedHttpRequest(
      headerOverrides: Record<string, string> = {},
      bodyOverride?: string,
    ) {
      const url = "https://stealth.test/api/v1/relay/messages";
      const actor = headerOverrides["x-stealth-address"] ?? testSender;
      const body = bodyOverride ?? JSON.stringify({ ...validBody(), sender: actor });
      const nonce = headerOverrides["x-stealth-nonce"] ?? "nonce-http-123456789012345678";
      const timestamp =
        headerOverrides["x-stealth-timestamp"] ?? new Date(NOW_SECONDS * 1000).toISOString();
      const audience = headerOverrides["x-stealth-audience"] ?? "relay:stealth.test";

      const headers: Record<string, string> = {
        host: "stealth.test",
        "content-type": "application/json",
        "x-stealth-address": actor,
        "x-stealth-nonce": nonce,
        "x-stealth-timestamp": timestamp,
        "x-stealth-audience": audience,
        ...headerOverrides,
      };

      if (!("x-stealth-signature" in headerOverrides)) {
        const canonical = canonicalizeSignedRequest({
          version: "STEALTH-AUTH-V1",
          method: "POST",
          url,
          headers,
          body,
        });
        headers["x-stealth-signature"] = testKeypair.sign(Buffer.from(canonical)).toString("hex");
      }

      return new Request(url, {
        method: "POST",
        headers,
        body,
      });
    }

    it("accepts a valid HTTP signed request once and returns 202", async () => {
      const service = makeRelayService();
      const request = submitSignedHttpRequest();

      const response = await handleRelaySubmit(request, service);
      expect(response.status).toBe(202);
    });

    it("rejects an HTTP signed request replayed nonce with 409", async () => {
      const service = makeRelayService();

      const req1 = submitSignedHttpRequest();
      const res1 = await handleRelaySubmit(req1, service);
      expect(res1.status).toBe(202);

      const req2 = submitSignedHttpRequest();
      const res2 = await handleRelaySubmit(req2, service);
      expect(res2.status).toBe(409);
    });

    it("rejects an HTTP signed request with tampered body with 401", async () => {
      const service = makeRelayService();
      const bodyOriginal = JSON.stringify({
        ...validBody(),
        sender: testSender,
      });
      const bodyTampered = JSON.stringify({
        ...validBody(),
        sender: testSender,
        payload: "tampered-payload",
      });

      const url = "https://stealth.test/api/v1/relay/messages";
      const headers: Record<string, string> = {
        host: "stealth.test",
        "content-type": "application/json",
        "x-stealth-address": testSender,
        "x-stealth-nonce": "nonce-http-tamper-123456789",
        "x-stealth-timestamp": new Date(NOW_SECONDS * 1000).toISOString(),
        "x-stealth-audience": "relay:stealth.test",
      };
      const canonical = canonicalizeSignedRequest({
        version: "STEALTH-AUTH-V1",
        method: "POST",
        url,
        headers,
        body: bodyOriginal,
      });
      headers["x-stealth-signature"] = testKeypair.sign(Buffer.from(canonical)).toString("hex");

      const request = new Request(url, {
        method: "POST",
        headers,
        body: bodyTampered,
      });

      const response = await handleRelaySubmit(request, service);
      expect(response.status).toBe(401);
    });

    it("rejects an HTTP signed request with stale timestamp with 400", async () => {
      const service = makeRelayService();
      const request = submitSignedHttpRequest({
        "x-stealth-timestamp": new Date((NOW_SECONDS - 600) * 1000).toISOString(),
      });

      const response = await handleRelaySubmit(request, service);
      expect(response.status).toBe(400);
    });

    it("rejects an HTTP signed request with audience mismatch with 403", async () => {
      const service = makeRelayService();
      const request = submitSignedHttpRequest({
        "x-stealth-audience": "relay:other.stealth",
      });

      const response = await handleRelaySubmit(request, service);
      expect(response.status).toBe(403);
    });
  });
});
