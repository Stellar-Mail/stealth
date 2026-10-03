import { describe, expect, it } from "vitest";
import { assertRustPin } from "../../../scripts/ci/verify-rust-version.mjs";

describe("Reproducible contract compiler pin", () => {
  it("accepts the same exact version in both sources", () => {
    expect(assertRustPin({ pinned: "1.98.0", channel: "1.98.0" }).ok).toBe(true);
  });

  it.each(["stable", "nightly", "beta", "1.98", undefined])(
    "rejects a non-exact pin: %s",
    (pinned) => {
      expect(assertRustPin({ pinned, channel: pinned }).ok).toBe(false);
    },
  );

  it.each(["stable", "1.99.0", undefined])("rejects compiler drift: %s", (channel) => {
    const result = assertRustPin({ pinned: "1.98.0", channel });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("expected 1.98.0");
  });
});
