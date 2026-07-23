import { describe, expect, it } from "vitest";

import {
  CodecError,
  fromBase64,
  fromHex,
  toBase64,
  toHex,
} from "../../../src/services/crypto/codec";

describe("strict hex/base64 codecs (#1695)", () => {
  it("toHex is canonical lowercase and round-trips", () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 255, 170]);
    const hex = toHex(bytes);
    expect(hex).toBe("00010f10ffaa");
    expect(fromHex(hex)).toEqual(bytes);
  });

  it("fromHex accepts uniform uppercase and matches lowercase", () => {
    expect(fromHex("00FF")).toEqual(new Uint8Array([0, 255]));
  });

  it("fromHex rejects mixed-case hex", () => {
    expect(() => fromHex("00Ff")).toThrowError(CodecError);
  });

  it("fromHex rejects odd-length input", () => {
    expect(() => fromHex("abc")).toThrowError(CodecError);
  });

  it("fromHex rejects empty input", () => {
    expect(() => fromHex("")).toThrowError(CodecError);
  });

  it("fromHex enforces expected length", () => {
    expect(() => fromHex("0011", 4)).toThrowError(CodecError);
    expect(fromHex("0011", 2)).toEqual(new Uint8Array([0, 17]));
  });

  it("toBase64 round-trips via fromBase64", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const b64 = toBase64(bytes);
    expect(fromBase64(b64)).toEqual(bytes);
  });

  it("fromBase64 rejects invalid characters", () => {
    expect(() => fromBase64("!!!!")).toThrowError(CodecError);
  });

  it("fromBase64 rejects length not a multiple of 4", () => {
    expect(() => fromBase64("abc")).toThrowError(CodecError);
  });

  it("fromBase64 handles valid padding at the end", () => {
    // 1 byte -> "AQ==" , 2 bytes -> "AgI=", 3 bytes -> "AgID"
    expect(fromBase64("AQ==")).toEqual(new Uint8Array([1]));
    expect(fromBase64("AgI=")).toEqual(new Uint8Array([2, 2]));
    expect(fromBase64("AgID")).toEqual(new Uint8Array([2, 2, 3]));
  });

  it("fromBase64 rejects padding in the middle", () => {
    expect(() => fromBase64("A=Q=")).toThrowError(CodecError);
  });

  it("fromBase64 enforces expected length", () => {
    expect(() => fromBase64("AQ==", 2)).toThrowError(CodecError);
    expect(fromBase64("AQ==", 1)).toEqual(new Uint8Array([1]));
  });

  it("codecs are property-stable: random bytes round-trip for hex and base64", () => {
    for (let i = 1; i < 50; i += 1) {
      const len = i % 17;
      if (len === 0) continue;
      const bytes = new Uint8Array(len);
      crypto.getRandomValues(bytes);
      expect(fromHex(toHex(bytes))).toEqual(bytes);
      expect(fromBase64(toBase64(bytes))).toEqual(bytes);
    }
  });
});
