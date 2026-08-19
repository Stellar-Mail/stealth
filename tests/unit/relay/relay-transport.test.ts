import { describe, expect, it } from "vitest";

import { MemoryRelayPersistence } from "../../../src/services/relay/memory-persistence";
import { InProcessRelayWorker } from "../../../src/services/relay/in-process-worker";
import { RelayService, type RelayServiceConfig } from "../../../src/services/relay/relay-service";
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

function makeService(config: RelayServiceConfig = makeConfig()) {
  const persistence = new MemoryRelayPersistence();
  const worker = new InProcessRelayWorker(persistence);
  const admission = {
    evaluate: async () => ({
      allowed: true as const,
      disposition: "request" as const,
      reason: "policy_satisfied" as const,
      rule: "default" as const,
      policyVersion: 1,
      requiredPostage: "0",
      source: "offchain" as const,
      evaluatedAt: "2026-08-19T21:00:00.000Z",
    }),
  };
  return new RelayService(persistence, worker, config, { admission });
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
      data: { ready: true, dependencies: { storage: "ok", queue: "ok", network: "ok" } },
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
    await expect(response.json()).resolves.toMatchObject({ error: { code: "unauthorized" } });
  });

  it("returns 401 when the actor header is not a Stellar address", async () => {
    const request = submitRequest("not-an-address", validBody());
    const response = await handleRelaySubmit(request, makeService());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "unauthorized" } });
  });

  it("returns 403 when the actor does not match the submitted sender", async () => {
    const request = submitRequest(otherActor, validBody());
    const response = await handleRelaySubmit(request, makeService());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "forbidden" } });
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
          disposition: "request",
          reason: "policy_satisfied",
        },
      },
    });
  });

  it("returns 422 for an invalid payload shape", async () => {
    const request = submitRequest(sender, { messageId: "not-a-hash" });
    const response = await handleRelaySubmit(request, makeService());

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "validation_error" } });
  });

  it("returns 413 when the body exceeds the relay body limit", async () => {
    const oversized = JSON.stringify({
      ...validBody(),
      payload: "x".repeat(2 * 1024 * 1024),
    });
    const request = submitRequest(sender, oversized);
    const response = await handleRelaySubmit(request, makeService());

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "bad_request" } });
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
