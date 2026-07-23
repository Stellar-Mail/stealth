import { describe, expect, it, vi } from "vitest";

import {
  planApiLog,
  shouldSampleRoutineSuccess,
  logger,
  redact,
  classifyError,
} from "../../../src/server/api/logging";
import { ApiError } from "../../../src/server/api/errors";

describe("API log sampling", () => {
  it("keeps deterministic sampling decisions per route and request ID", () => {
    const decisions = Array.from({ length: 5 }, () =>
      shouldSampleRoutineSuccess("/postage/quote", "request-123", { successSampleRate: 0.25 }),
    );

    expect(new Set(decisions).size).toBe(1);
  });

  it("allows routine success logs to be sampled by configured rate", () => {
    expect(shouldSampleRoutineSuccess("/health", "request-1", { successSampleRate: 0 })).toBe(
      false,
    );
    expect(shouldSampleRoutineSuccess("/health", "request-1", { successSampleRate: 1 })).toBe(true);
  });

  it("never samples out security denials or unexpected errors", () => {
    expect(
      planApiLog(
        {
          route: "/policies/owner",
          requestId: "request-1",
          status: 403,
          outcome: "security_denied",
        },
        { successSampleRate: 0 },
      ).log,
    ).toMatchObject({ outcome: "security_denied", samplingRate: 1 });

    expect(
      planApiLog(
        { route: "/postage", requestId: "request-2", status: 500, outcome: "unexpected_error" },
        { successSampleRate: 0 },
      ).log,
    ).toMatchObject({ outcome: "unexpected_error", samplingRate: 1 });
  });

  it("counts metrics for all requests even when routine success logs are not emitted", () => {
    const decision = planApiLog(
      { route: "/health", requestId: "request-3", status: 200, outcome: "success" },
      { successSampleRate: 0 },
    );

    expect(decision.log).toBeUndefined();
    expect(decision.metrics).toEqual([
      { metric: "api.requests_total", route: "/health", status: 200, outcome: "success" },
    ]);
  });
});

describe("Structured Logger and Redaction", () => {
  it("redacts sensitive fields (authorization, signatures, nonces, bodies, cookies, tokens) case-insensitively", () => {
    const dirtyData = {
      authorization: "Bearer secret-token",
      "X-Signature": "sig123",
      nonce: "nonce456",
      cookie: "session=xyz",
      token: "supersecret",
      apiKey: "key-abc",
      password: "pass",
      secret: "shh",
      body: { sensitive: "data" },
      safeField: "safe-value",
    };

    const cleanData = redact(dirtyData);

    expect(cleanData.authorization).toBe("[REDACTED]");
    expect(cleanData["X-Signature"]).toBe("[REDACTED]");
    expect(cleanData.nonce).toBe("[REDACTED]");
    expect(cleanData.cookie).toBe("[REDACTED]");
    expect(cleanData.token).toBe("[REDACTED]");
    expect(cleanData.apiKey).toBe("[REDACTED]");
    expect(cleanData.password).toBe("[REDACTED]");
    expect(cleanData.secret).toBe("[REDACTED]");
    expect(cleanData.body).toBe("[REDACTED]");
    expect(cleanData.safeField).toBe("safe-value");
  });

  it("redacts nested values inside objects and arrays recursively", () => {
    const complexData = {
      user: {
        name: "Alice",
        secretToken: "12345",
      },
      list: [
        { id: 1, signature: "s1" },
        { id: 2, signature: "s2" },
      ],
    };

    const cleanData = redact(complexData);

    expect(cleanData.user.name).toBe("Alice");
    expect(cleanData.user.secretToken).toBe("[REDACTED]");
    expect(cleanData.list[0].signature).toBe("[REDACTED]");
    expect(cleanData.list[1].signature).toBe("[REDACTED]");
    expect(cleanData.list[0].id).toBe(1);
  });

  it("handles circular references safely by replacing with [Circular]", () => {
    const cyclicObj: any = { a: 1 };
    cyclicObj.self = cyclicObj;

    const cleanData = redact(cyclicObj);
    expect(cleanData.a).toBe(1);
    expect(cleanData.self).toBe("[Circular]");
  });

  it("handles Headers objects case-insensitively and redacts sensitive headers", () => {
    // Check if Headers is defined in global scope (it is in Bun/browser)
    if (typeof Headers !== "undefined") {
      const headers = new Headers();
      headers.set("Authorization", "secret");
      headers.set("Content-Type", "application/json");
      headers.set("x-nonce", "abc123nonce");

      const cleanHeaders = redact(headers);
      expect(cleanHeaders.authorization).toBe("[REDACTED]");
      expect(cleanHeaders["content-type"]).toBe("application/json");
      expect(cleanHeaders["x-nonce"]).toBe("[REDACTED]");
    }
  });

  it("logs structured fields via console.log without failing the API request on error", () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      logger.log({
        routeId: "/api/test",
        requestId: "req-1",
        status: 200,
        durationMs: 45,
        method: "GET",
        headers: {
          authorization: "Bearer test",
          "Content-Type": "application/json",
        },
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      const loggedString = consoleLogSpy.mock.calls[0][0];
      const parsedLog = JSON.parse(loggedString);

      expect(parsedLog.routeId).toBe("/api/test");
      expect(parsedLog.requestId).toBe("req-1");
      expect(parsedLog.status).toBe(200);
      expect(parsedLog.durationMs).toBe(45);
      expect(parsedLog.method).toBe("GET");
      expect(parsedLog.metadata.headers.authorization).toBe("[REDACTED]");
      expect(parsedLog.metadata.headers["Content-Type"]).toBe("application/json");
    } finally {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });

  it("logger failures do not throw errors or fail the request", () => {
    // Force redact or classification to throw, or throw inside JSON.stringify
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Create an object where accessing a property throws an error
    const brokenObject = {
      get breakingProperty() {
        throw new Error("Simulated failure during property access");
      },
    };

    try {
      // Should not throw
      expect(() => {
        logger.log({
          routeId: "/api/broken",
          requestId: "req-broken",
          status: 500,
          durationMs: 120,
          error: new ApiError(500, "internal_error", "An internal error"),
          badProperty: brokenObject,
        });
      }).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    }
  });
});
