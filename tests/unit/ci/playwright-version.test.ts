import { describe, expect, it } from "vitest";
import { assertPlaywrightPin } from "../../../scripts/ci/verify-playwright-version.mjs";

describe("Playwright lockfile pin", () => {
  it("accepts matching pin, installed package, and local binary", () => {
    const result = assertPlaywrightPin({
      pinned: "1.61.1",
      installed: "1.61.1",
      runnerBin: undefined,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a CI pin that does not match the installed lockfile version", () => {
    const result = assertPlaywrightPin({
      pinned: "1.49.1",
      installed: "1.61.1",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/1\.49\.1/);
  });
});
