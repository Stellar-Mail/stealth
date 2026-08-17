import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseSearchParams } from "../../../src/server/api/request";

const cursorSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const multiSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  tag: z.array(z.string()).optional(),
});

function captureError(fn: () => unknown): { status: number; code: string; message: string } {
  try {
    fn();
  } catch (error) {
    const e = error as { status: number; code: string; message: string };
    return { status: e.status, code: e.code, message: e.message };
  }
  throw new Error("Expected function to throw");
}

describe("parseSearchParams — duplicate scalar rejection", () => {
  it("rejects duplicate limit parameters", () => {
    const request = new Request("https://stealth.test/api?limit=10&limit=100");
    const error = captureError(() => parseSearchParams(request, cursorSchema));
    expect(error.status).toBe(400);
    expect(error.code).toBe("bad_request");
    expect(error.message).toMatch(/Duplicate query parameter: limit/);
  });

  it("rejects duplicate cursor parameters", () => {
    const request = new Request("https://stealth.test/api?cursor=abc&cursor=def");
    const error = captureError(() => parseSearchParams(request, cursorSchema));
    expect(error.status).toBe(400);
    expect(error.message).toMatch(/Duplicate query parameter: cursor/);
  });

  it("identifies the duplicated field in the error message", () => {
    const request = new Request("https://stealth.test/api?limit=1&limit=2");
    const error = captureError(() => parseSearchParams(request, cursorSchema));
    expect(error.message).toContain("limit");
    expect(error.message).toMatch(/Expected a single value for 'limit'/);
  });

  it("rejects duplicates even when values differ", () => {
    const request = new Request("https://stealth.test/api?limit=10&limit=99");
    expect(() => parseSearchParams(request, cursorSchema)).toThrow();
  });

  it("rejects duplicates even when values are identical", () => {
    const request = new Request("https://stealth.test/api?limit=10&limit=10");
    expect(() => parseSearchParams(request, cursorSchema)).toThrow();
  });

  it("keeps duplicate-parameter errors ahead of schema validation", () => {
    const request = new Request("https://stealth.test/api?limit=abc&limit=100");
    const error = captureError(() => parseSearchParams(request, cursorSchema));
    expect(error.message).toMatch(/Duplicate query parameter: limit/);
  });
});

describe("parseSearchParams — single-valued passthrough", () => {
  it("accepts a single cursor and limit", () => {
    const request = new Request("https://stealth.test/api?cursor=abc&limit=25");
    expect(parseSearchParams(request, cursorSchema)).toEqual({
      cursor: "abc",
      limit: 25,
    });
  });

  it("returns empty object when all params are optional and absent", () => {
    const request = new Request("https://stealth.test/api");
    expect(parseSearchParams(request, cursorSchema)).toEqual({});
  });
});

describe("parseSearchParams — multi-valued fields", () => {
  it("preserves all values for declared multi-valued fields", () => {
    const request = new Request("https://stealth.test/api?tag=a&tag=b&tag=c&limit=10");
    expect(
      parseSearchParams(request, multiSchema, {
        multiValuedFields: new Set(["tag"]),
      }),
    ).toEqual({ tag: ["a", "b", "c"], limit: 10 });
  });

  it("returns a single-element array for one occurrence", () => {
    const request = new Request("https://stealth.test/api?tag=solo&limit=5");
    expect(
      parseSearchParams(request, multiSchema, {
        multiValuedFields: new Set(["tag"]),
      }),
    ).toEqual({ tag: ["solo"], limit: 5 });
  });

  it("omits multi-valued key from result when not present", () => {
    const request = new Request("https://stealth.test/api?limit=5");
    const result = parseSearchParams(request, multiSchema, {
      multiValuedFields: new Set(["tag"]),
    });
    expect(result).toEqual({ limit: 5 });
    expect(result).not.toHaveProperty("tag");
  });

  it("still rejects duplicate scalar params alongside multi-valued fields", () => {
    const request = new Request("https://stealth.test/api?tag=a&tag=b&limit=10&limit=20");
    const error = captureError(() =>
      parseSearchParams(request, multiSchema, {
        multiValuedFields: new Set(["tag"]),
      }),
    );
    expect(error.status).toBe(400);
    expect(error.message).toMatch(/Duplicate query parameter: limit/);
  });

  it("NFC-normalizes multi-valued field entries", () => {
    // %65%CC%81 = "e" + combining acute → NFC "é"
    const request = new Request("https://stealth.test/api?q=%65%CC%81&q=plain");
    const schema = z.object({ q: z.array(z.string()) });
    const result = parseSearchParams(request, schema, {
      multiValuedFields: new Set(["q"]),
    });
    expect(result.q).toEqual(["é", "plain"]);
  });
});
