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
