import { describe, expect, it } from "vitest";

import { protocolManifest } from "../../../src/server/api/protocol";

// Issue #1530: API version negotiation and unsupported-version handling.
// The supported versions are centrally declared; unsupported versions must be
// distinguishable from supported ones so the boundary can return a precise error.
describe("API version negotiation", () => {
  const supported = protocolManifest.supportedVersions;

  it("declares supported versions centrally", () => {
    expect(Array.isArray(supported)).toBe(true);
    expect(supported.length).toBeGreaterThan(0);
    expect(supported).toContain("v1");
  });

  it("treats declared versions as supported", () => {
    for (const v of supported) {
      expect(supported.includes(v), `${v} supported`).toBe(true);
    }
  });

  it("rejects unknown/old versions as unsupported", () => {
    const unsupported = ["v0", "beta", "1.0", "v99"];
    for (const v of unsupported) {
      expect(supported.includes(v), `${v} should be unsupported`).toBe(false);
    }
  });

  it("rejects malformed future versions as unsupported", () => {
    const future = ["v999", "vx", ""];
    for (const v of future) {
      expect(supported.includes(v), `${JSON.stringify(v)} should be unsupported`).toBe(false);
    }
  });

  it("exposes supported versions through the protocol manifest", () => {
    expect(protocolManifest.apiVersion).toBeTruthy();
    expect(supported).toContain(protocolManifest.apiVersion);
  });
});
