import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { validateApiConfig } from "../../../src/server/api/context";

// Issue #1516: startup configuration validation gate.
describe("validateApiConfig", () => {
  const base = {
    isProd: false,
    supportedVersions: ["v1"] as const,
  };

  it("accepts a minimal development configuration", () => {
    expect(() => validateApiConfig({ ...base, isProd: false })).not.toThrow();
  });

  it("accepts a complete production configuration", () => {
    expect(() =>
      validateApiConfig({
        isProd: true,
        kvBinding: {},
        coordinatorBinding: {},
        cursorSecret: "secret-value",
        supportedVersions: ["v1"],
      }),
    ).not.toThrow();
  });

  it("fails when production is missing the KV binding", () => {
    expect(() => validateApiConfig({ isProd: true, supportedVersions: ["v1"] })).toThrow(
      /STEALTH_KV/,
    );
  });

  it("fails when production is missing the coordinator binding", () => {
    expect(() =>
      validateApiConfig({
        isProd: true,
        kvBinding: {},
        supportedVersions: ["v1"],
      }),
    ).toThrow(/STEALTH_COORDINATOR/);
  });

  it("fails when production is missing the cursor secret", () => {
    expect(() =>
      validateApiConfig({
        isProd: true,
        kvBinding: {},
        coordinatorBinding: {},
        supportedVersions: ["v1"],
      }),
    ).toThrow(/STEALTH_CURSOR_SECRET/);
  });

  it("never leaks the secret value in the error message", () => {
    let message = "";
    try {
      validateApiConfig({
        isProd: true,
        kvBinding: {},
        coordinatorBinding: {},
        cursorSecret: "super-secret-do-not-leak",
        supportedVersions: ["v1"],
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toContain("super-secret-do-not-leak");
  });

  it("fails when no supported versions are configured", () => {
    expect(() => validateApiConfig({ ...base, isProd: false, supportedVersions: [] })).toThrow(
      /supported protocol version/,
    );
  });

  it("does not require prod bindings in development", () => {
    expect(() => validateApiConfig({ ...base, isProd: false })).not.toThrow();
  });
});

import { createRequestContext } from "../../../src/server/api/context";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";

describe("RequestContext creation", () => {
  it("creates a default request context with headers", async () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        "x-request-id": "test-req-123",
        "x-stealth-address": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB",
      },
    });

    const context = await createRequestContext({
      request,
      routeId: "/api/test",
    });

    expect(context.requestId).toBe("test-req-123");
    expect(context.routeId).toBe("/api/test");
    expect(context.principal).toBe("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB");
    expect(context.repository).toBeDefined();
    expect(context.logger).toBeDefined();
    expect(context.metrics).toBeDefined();
  });

  it("supports dependency injection for repository and requestId", async () => {
    const customRepo = new MemoryApiRepository();
    const request = new Request("http://localhost/api/test");

    const context = await createRequestContext({
      request,
      routeId: "/api/test",
      repository: customRepo,
      requestId: "custom-id-999",
      principal: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    });

    expect(context.repository).toBe(customRepo);
    expect(context.requestId).toBe("custom-id-999");
    expect(context.principal).toBe("GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
  });
});
