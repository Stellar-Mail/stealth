import { describe, expect, it } from "vitest";

import {
  constantTimeEqual,
  constantTimeEqualOrThrow,
} from "../../../src/services/crypto/constant-time";

function bytes(values: number[]): Uint8Array {
  return new Uint8Array(values);
}

describe("constant-time byte comparison (#1718)", () => {
  it("returns true for identical equal-length values", () => {
    expect(constantTimeEqual(bytes([1, 2, 3, 4]), bytes([1, 2, 3, 4]))).toBe(true);
  });

  it("returns false for equal-length values differing at every position", () => {
    expect(constantTimeEqual(bytes([1, 2, 3, 4]), bytes([5, 6, 7, 8]))).toBe(false);
  });

  it("returns false for a difference at each position (no early exit behavior)", () => {
    const base = [10, 20, 30, 40, 50];
    for (let pos = 0; pos < base.length; pos += 1) {
      const other = base.slice();
      other[pos] = base[pos] + 1;
      expect(constantTimeEqual(bytes(base), bytes(other))).toBe(false);
    }
  });

  it("does not leak length via an early length-only shortcut", () => {
    // A length mismatch must not be distinguishable from a content mismatch by
    // returning early; the helper still compares the overlapping prefix.
    expect(constantTimeEqual(bytes([1, 2, 3]), bytes([1, 2]))).toBe(false);
    expect(constantTimeEqual(bytes([1, 2]), bytes([1, 2, 3]))).toBe(false);
    expect(constantTimeEqual(bytes([]), bytes([1]))).toBe(false);
  });

  it("handles zero-length inputs as equal", () => {
    expect(constantTimeEqual(bytes([]), bytes([]))).toBe(true);
  });

  it("constantTimeEqualOrThrow returns true for matching lengths", () => {
    expect(constantTimeEqualOrThrow(bytes([9, 9]), bytes([9, 9]))).toBe(true);
  });

  it("constantTimeEqualOrThrow throws on length mismatch", () => {
    expect(() => constantTimeEqualOrThrow(bytes([1]), bytes([1, 2]))).toThrowError(
      expect.objectContaining({ code: "crypto_validation_error" }),
    );
  });

  it("compares decoded bytes rather than encoded strings unambiguously", () => {
    // Hex strings can compare equal as strings but differ as bytes; the helper
    // operates on decoded bytes so encoding never affects the result.
    const a = bytes([0xff]);
    const b = bytes([0xff]);
    expect(constantTimeEqual(a, b)).toBe(true);
    const c = bytes([0xfe]);
    expect(constantTimeEqual(a, c)).toBe(false);
  });
});
