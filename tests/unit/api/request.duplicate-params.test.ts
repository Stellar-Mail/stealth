import { describe, expect, it } from "vitest";

import { parseSearchParams } from "../../../src/server/api/request";
import { z } from "zod";

const cursorSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

describe("parseSearchParams duplicate scalar handling", () => {
  it("rejects duplicate scalar query params such as limit", () => {
    const request = new Request("https://stealth.test/api?limit=10&limit=100");
    expect(() => parseSearchParams(request, cursorSchema)).toThrow();
    try {
      parseSearchParams(request, cursorSchema);
    } catch (error) {
      expect(error).toMatchObject({
        status: 400,
        code: "bad_request",
      });
      expect((error as Error).message).toMatch(/Duplicate query parameter: limit/);
    }
  });

  it("keeps schema errors separate from duplicate-parameter errors", () => {
    const request = new Request("https://stealth.test/api?limit=abc&limit=100");
    expect(() => parseSearchParams(request, cursorSchema)).toThrow();
    try {
      parseSearchParams(request, cursorSchema);
    } catch (error) {
      expect((error as Error).message).toMatch(/Duplicate query parameter: limit/);
    }
  });

  it("preserves behavior for single-valued params", () => {
    const request = new Request("https://stealth.test/api?cursor=abc&limit=25");
    expect(parseSearchParams(request, cursorSchema)).toEqual({
      cursor: "abc",
      limit: 25,
    });
  });
});
