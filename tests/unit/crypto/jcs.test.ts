import { describe, it, expect } from "vitest";
import { canonicalize } from "@/services/crypto/jcs";

describe("canonicalize (RFC 8785)", () => {
  it("serializes primitives correctly", () => {
    expect(canonicalize(null)).toBe("null");
    expect(canonicalize(true)).toBe("true");
    expect(canonicalize(false)).toBe("false");
    expect(canonicalize(42)).toBe("42");
    expect(canonicalize(3.14159)).toBe("3.14159");
    expect(canonicalize(-0)).toBe("0"); // RFC 8785: -0 is formatted as "0"
    expect(canonicalize("hello")).toBe('"hello"');
  });

  it("fails explicitly on unsupported types", () => {
    expect(() => canonicalize(undefined)).toThrowError();
    expect(() => canonicalize(NaN)).toThrowError();
    expect(() => canonicalize(Infinity)).toThrowError();
    expect(() => canonicalize(-Infinity)).toThrowError();
    expect(() => canonicalize(Symbol("sym"))).toThrowError();
    expect(() => canonicalize(() => {})).toThrowError();
    expect(() => canonicalize(123n)).toThrowError(); // BigInt
  });

  it("escapes strings properly, handling control chars", () => {
    expect(canonicalize('a\nb\tc\rd\be\ff"g\\h')).toBe('"a\\nb\\tc\\rd\\be\\ff\\"g\\\\h"');
    // Control characters U+0000 to U+001F
    expect(canonicalize("\x00\x1f")).toBe('"\\u0000\\u001f"');
  });

  it("handles arrays and nested arrays deterministically", () => {
    expect(canonicalize([])).toBe("[]");
    expect(canonicalize([1, 2, 3])).toBe("[1,2,3]");
    expect(canonicalize(["a", null, true])).toBe('["a",null,true]');
    expect(canonicalize([[1, 2], [3]])).toBe("[[1,2],[3]]");
  });

  it("throws on unsupported values inside arrays", () => {
    expect(() => canonicalize([1, undefined, 3])).toThrowError();
    expect(() => canonicalize([NaN])).toThrowError();
  });

  it("sorts object keys lexicographically based on UTF-16", () => {
    const input = {
      c: 3,
      a: 1,
      b: 2,
    };
    expect(canonicalize(input)).toBe('{"a":1,"b":2,"c":3}');
  });

  it("handles complex nested objects and arrays deterministically", () => {
    const input = {
      nested: {
        z: "last",
        a: "first",
        arr: [{ b: 2, a: 1 }, null],
      },
      top: true,
    };
    const expected = '{"nested":{"a":"first","arr":[{"a":1,"b":2},null],"z":"last"},"top":true}';
    expect(canonicalize(input)).toBe(expected);
  });

  it("throws on unsupported values inside objects", () => {
    expect(() => canonicalize({ a: 1, b: undefined })).toThrowError();
    expect(() => canonicalize({ a: NaN })).toThrowError();
  });

  it("handles toJSON if present", () => {
    const obj = {
      a: 1,
      toJSON() {
        return { c: 3, b: 2 };
      },
    };
    expect(canonicalize(obj)).toBe('{"b":2,"c":3}');
  });

  it("handles official RFC 8785 vectors", () => {
    const vector1 = {
      input: {
        "1": 1,
        a: "a",
        b: "b",
        A: "A",
        B: "B",
      },
      expected: '{"1":1,"A":"A","B":"B","a":"a","b":"b"}',
    };
    expect(canonicalize(vector1.input)).toBe(vector1.expected);

    const vector2 = {
      input: {
        "\u20ac": "Euro Sign",
        "\r": "Carriage Return",
        "\u000f": "Control Character",
      },
      // Note: \r is escaped as \r, \u000f is escaped as \u000f. Euro sign is unescaped.
      expected: '{"\\r":"Carriage Return","\\u000f":"Control Character","€":"Euro Sign"}',
    };
    expect(canonicalize(vector2.input)).toBe(vector2.expected);
  });
});
