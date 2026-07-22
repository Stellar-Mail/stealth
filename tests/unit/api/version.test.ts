import { describe, expect, it } from "vitest";

import { protocolManifest } from "../../../src/server/api/protocol";
import { getVersionInfo } from "../../../src/server/api/version";

// Issue #1522: build + protocol versions must be exposed safely.
describe("version info", () => {
  it("exposes an explicit, non-empty build identifier", () => {
    const info = getVersionInfo();
    expect(typeof info.build).toBe("string");
    expect(info.build.length).toBeGreaterThan(0);
  });

  it("reports the api version and supported versions from the protocol manifest", () => {
    const info = getVersionInfo();
    expect(info.apiVersion).toBe(protocolManifest.apiVersion);
    expect(info.supportedVersions).toEqual(protocolManifest.supportedVersions);
  });

  it("is deterministic and not influenced by any argument", () => {
    const first = JSON.stringify(getVersionInfo());
    const second = JSON.stringify(getVersionInfo());
    expect(first).toBe(second);
  });

  it("never leaks secrets or filesystem paths", () => {
    const serialized = JSON.stringify(getVersionInfo());
    expect(serialized).not.toMatch(/secret|password|token|key/i);
    expect(serialized).not.toMatch(/[A-Za-z]:\\|\/(home|Users|var|etc)\//);
  });
});
