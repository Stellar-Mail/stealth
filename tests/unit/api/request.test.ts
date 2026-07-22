import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseJsonBody, parseSearchParams } from "../../../src/server/api/request";

describe("API request parsing", () => {
  it("validates JSON bodies", async () => {
    const request = new Request("https://stealth.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: 125 }),
    });

    await expect(
      parseJsonBody(request, z.object({ amount: z.number().int().positive() })),
    ).resolves.toEqual({ amount: 125 });
  });

  it("rejects non-JSON content types", async () => {
    const request = new Request("https://stealth.test/api", {
      method: "POST",
      body: "amount=125",
    });

    await expect(parseJsonBody(request, z.object({}))).rejects.toMatchObject({ status: 415 });
  });

  it("coerces and validates search parameters", () => {
    const request = new Request("https://stealth.test/api?limit=10");

    expect(parseSearchParams(request, z.object({ limit: z.coerce.number() }))).toEqual({
      limit: 10,
    });
  });
});

describe("Query string normalization", () => {
  const passthrough = z.object({}).catchall(z.string());

  function captureError(fn: () => unknown): unknown {
    try {
      fn();
    } catch (error) {
      return error;
    }
    throw new Error("Expected function to throw");
  }

  it("leaves valid ASCII values unchanged", () => {
    const request = new Request("https://stealth.test/api?cursor=abc123DEF&limit=25");

    expect(parseSearchParams(request, passthrough)).toEqual({
      cursor: "abc123DEF",
      limit: "25",
    });
  });

  it("rejects duplicate scalar parameter names", () => {
    const request = new Request("https://stealth.test/api?cursor=first&cursor=second");

    expect(captureError(() => parseSearchParams(request, passthrough))).toMatchObject({
      status: 400,
      code: "bad_request",
    });
  });

  it("rejects empty parameter names", () => {
    const request = new Request("https://stealth.test/api?=orphan");

    expect(captureError(() => parseSearchParams(request, passthrough))).toMatchObject({
      status: 400,
      code: "bad_request",
    });
  });

  it("rejects control characters in a value", () => {
    const request = new Request("https://stealth.test/api?cursor=%01abc");

    expect(captureError(() => parseSearchParams(request, passthrough))).toMatchObject({
      status: 400,
    });
  });

  it("rejects control characters in a parameter name", () => {
    const request = new Request("https://stealth.test/api?%01name=value");

    expect(captureError(() => parseSearchParams(request, passthrough))).toMatchObject({
      status: 400,
    });
  });

  it("enforces the total query length limit", () => {
    const request = new Request("https://stealth.test/api?cursor=abcdef");

    expect(
      captureError(() => parseSearchParams(request, passthrough, { maxQueryLength: 5 })),
    ).toMatchObject({ status: 414 });
  });

  it("enforces the per-value length limit", () => {
    const request = new Request("https://stealth.test/api?cursor=abcdef");

    expect(
      captureError(() => parseSearchParams(request, passthrough, { maxValueLength: 3 })),
    ).toMatchObject({ status: 414 });
  });

  it("NFC-normalizes decomposed Unicode so equivalent sequences validate identically", () => {
    // %65%CC%81 is "e" + combining acute accent (U+0301); NFC folds it to "é" (U+00E9).
    const request = new Request("https://stealth.test/api?q=%65%CC%81");

    const result = parseSearchParams(request, passthrough);
    expect(result.q).toBe("é");
    expect(result.q).toHaveLength(1);
    expect(result.q.normalize("NFC")).toBe(result.q);
  });
});
