import { describe, expect, it } from "vitest";

import {
  clearSecret,
  disposeRawKey,
  isZeroed,
  withSecretBuffer,
} from "../../../src/services/crypto/secret-buffer";

describe("secret buffer disposal (#1719)", () => {
  it("clearSecret zeroes a mutable buffer and returns it", () => {
    const buf = new Uint8Array([1, 2, 3, 4, 5]);
    const result = clearSecret(buf);
    expect(result).toBe(buf);
    expect(isZeroed(buf)).toBe(true);
  });

  it("withSecretBuffer clears the buffer after the action (finally)", () => {
    let captured: Uint8Array | undefined;
    const out = withSecretBuffer(8, (buf) => {
      buf.set([9, 8, 7, 6, 5, 4, 3, 2]);
      captured = buf;
      return "done";
    });
    expect(out).toBe("done");
    // After the callback, the buffer must be zeroed.
    expect(captured).toBeDefined();
    expect(isZeroed(captured as Uint8Array)).toBe(true);
  });

  it("withSecretBuffer clears even if the action throws", () => {
    const bufRef: Uint8Array[] = [];
    expect(() =>
      withSecretBuffer(4, (buf) => {
        buf.set([1, 1, 1, 1]);
        bufRef.push(buf);
        throw new Error("boom");
      }),
    ).toThrowError("boom");
    expect(isZeroed(bufRef[0])).toBe(true);
  });

  it("disposeRawKey works for an ArrayBuffer and a Uint8Array view", () => {
    const ab = new Uint8Array([7, 7, 7]).buffer;
    disposeRawKey(ab);
    expect(isZeroed(new Uint8Array(ab))).toBe(true);

    const view = new Uint8Array([3, 2, 1]);
    disposeRawKey(view);
    expect(isZeroed(view)).toBe(true);
  });

  it("isZeroed reports correctly for non-empty and empty buffers", () => {
    expect(isZeroed(new Uint8Array([0, 0]))).toBe(true);
    expect(isZeroed(new Uint8Array([0, 1]))).toBe(false);
    expect(isZeroed(new Uint8Array(0))).toBe(true);
  });
});
