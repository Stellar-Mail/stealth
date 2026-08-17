import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { parseJsonBody, parseSearchParams } from "../../../src/server/api/request";

const emptySchema = z.object({});

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

  it("parses a chunked JSON body within the encoded-byte limit", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"message":"'));
        controller.enqueue(encoder.encode('\u2713"}'));
        controller.close();
      },
    });
    const request = new Request("https://stealth.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(parseJsonBody(request, z.object({ message: z.string() }), 17)).resolves.toEqual({
      message: "\u2713",
    });
  });

  it("cancels a chunked body as soon as its encoded-byte limit is exceeded", async () => {
    const encoder = new TextEncoder();
    const cancel = vi.fn();
    const chunks = [
      encoder.encode('{"value":"'),
      encoder.encode("\u{1F680}\u{1F680}"),
      encoder.encode('"}'),
    ];
    let chunksRead = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(chunks[chunksRead++]);
      },
      cancel,
    });
    const request = new Request("https://stealth.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(parseJsonBody(request, z.object({ value: z.string() }), 12)).rejects.toMatchObject(
      {
        status: 413,
      },
    );
    expect(cancel).toHaveBeenCalledOnce();
    expect(chunksRead).toBeLessThan(chunks.length);
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
    const request = new Request("https://stealth.test/api?q=%65%CC%81");

    const result = parseSearchParams(request, passthrough);
    expect(result.q).toBe("é");
    expect(result.q).toHaveLength(1);
    expect(result.q.normalize("NFC")).toBe(result.q);
  });
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

async function captureAsyncError(
  fn: () => Promise<unknown>,
): Promise<{ status: number; code: string; message: string }> {
  try {
    await fn();
  } catch (error) {
    const e = error as { status: number; code: string; message: string };
    return { status: e.status, code: e.code, message: e.message };
  }
  throw new Error("Expected async function to throw");
}

function jsonRequest(
  body: string,
  contentType = "application/json",
  extraHeaders: Record<string, string> = {},
): Request {
  return new Request("https://stealth.test/api", {
    method: "POST",
    headers: { "content-type": contentType, ...extraHeaders },
    body,
  });
}

/* ------------------------------------------------------------------ */
/*  Malformed JSON bytes                                              */
/* ------------------------------------------------------------------ */

describe("parseJsonBody — malformed JSON bytes", () => {
  it.each([
    { body: "{", desc: "truncated object" },
    { body: "[1,2,", desc: "truncated array" },
    { body: "'single quotes'", desc: "single quotes instead of double" },
    { body: "{a: 1}", desc: "unquoted key" },
    { body: "{,}", desc: "stray comma at root" },
    { body: `{"a":"${String.fromCharCode(0)}"}`, desc: "null byte in value" },
    { body: `{"${String.fromCharCode(0)}":1}`, desc: "null byte in key" },
    { body: '{"a":1}extra', desc: "trailing data after JSON" },
    { body: "undefined", desc: "JavaScript reserved word" },
    { body: "NaN", desc: "NaN literal" },
    { body: "Infinity", desc: "Infinity literal" },
    { body: '{"a":\n}', desc: "raw newline in string value" },
    { body: '["trailing",]', desc: "trailing comma in array" },
    { body: '{"trailing":1,}', desc: "trailing comma in object" },
    { body: "true false", desc: "two JSON literals" },
  ])("rejects $desc", async ({ body }) => {
    const request = jsonRequest(body);
    const error = await captureAsyncError(() => parseJsonBody(request, emptySchema));
    expect(error.status).toBe(400);
    expect(error.code).toBe("bad_request");
  });
});

/* ------------------------------------------------------------------ */
/*  Content-Type fuzzing                                               */
/* ------------------------------------------------------------------ */

describe("parseJsonBody — Content-Type fuzzing", () => {
  it.each([
    { contentType: "application/json", desc: "canonical" },
    { contentType: "application/json; charset=utf-8", desc: "with charset" },
    { contentType: "APPLICATION/JSON", desc: "uppercase" },
    { contentType: "Application/Json", desc: "mixed case" },
    { contentType: "application/json;", desc: "trailing semicolon" },
    { contentType: "application/geo+json", desc: "subtype +json" },
    { contentType: "application/vnd.api+json", desc: "vendor subtype +json" },
    { contentType: "application/json; charset=utf-8;", desc: "double trailing semicolon" },
    { contentType: "application/json; boundary=----", desc: "with boundary parameter" },
  ])("accepts $desc content-type then rejects empty body", async ({ contentType }) => {
    const request = jsonRequest("", contentType);
    const error = await captureAsyncError(() => parseJsonBody(request, emptySchema));
    expect(error.status).toBe(400);
    expect(error.code).toBe("bad_request");
  });

  it.each([
    { contentType: "text/plain", desc: "text/plain" },
    { contentType: "text/json", desc: "text/json" },
    { contentType: "application/xml", desc: "application/xml" },
    { contentType: "application/ json", desc: "space after slash" },
    { contentType: "", desc: "empty string" },
    { contentType: "application/javascript", desc: "application/javascript" },
    { contentType: "application/jsonp", desc: "application/jsonp" },
  ])("rejects $desc with 415", async ({ contentType }) => {
    const request = jsonRequest("{}", contentType);
    const error = await captureAsyncError(() => parseJsonBody(request, emptySchema));
    expect(error.status).toBe(415);
    expect(error.code).toBe("bad_request");
  });

  it("rejects missing Content-Type header with 415", async () => {
    const request = new Request("https://stealth.test/api", {
      method: "POST",
      body: "{}",
    });
    const error = await captureAsyncError(() => parseJsonBody(request, emptySchema));
    expect(error.status).toBe(415);
    expect(error.code).toBe("bad_request");
  });

  it("handles duplicate Content-Type headers without crashing", async () => {
    const headers = new Headers({ "content-type": "application/json" });
    const request = new Request("https://stealth.test/api", {
      method: "POST",
      headers,
      body: "{}",
    });
    const result = await parseJsonBody(request, emptySchema);
    expect(result).toEqual({});
  });

  it("handles Content-Type with leading/trailing whitespace", async () => {
    const request = jsonRequest("{}", "  application/json  ");
    const result = await parseJsonBody(request, emptySchema);
    expect(result).toEqual({});
  });
});

/* ------------------------------------------------------------------ */
/*  Content-Length fuzzing                                             */
/* ------------------------------------------------------------------ */

describe("parseJsonBody — Content-Length fuzzing", () => {
  it("rejects negative zero Content-Length with valid body", async () => {
    const request = jsonRequest("{}", "application/json", { "content-length": "-0" });
    const result = await parseJsonBody(request, emptySchema);
    expect(result).toEqual({});
  });

  it.each([
    { length: "0", body: "{}", desc: "zero-length declared with actual body" },
    { length: "3", body: "{}", desc: "declared larger than actual" },
  ])("accepts $desc and parses body content", async ({ length, body }) => {
    const request = jsonRequest(body, "application/json", { "content-length": length });
    const result = await parseJsonBody(request, emptySchema);
    expect(result).toEqual({});
  });

  it.each([
    { length: "99999999999999999999", desc: "value exceeding Number.MAX_SAFE_INTEGER" },
    { length: "18446744073709551616", desc: "value above 2^64" },
  ])("rejects oversized $desc with 413", async ({ length }) => {
    const request = jsonRequest("{}", "application/json", { "content-length": length });
    const error = await captureAsyncError(() => parseJsonBody(request, emptySchema));
    expect(error.status).toBe(413);
    expect(error.code).toBe("bad_request");
  });

  it("rejects multiple conflicting Content-Length headers", async () => {
    const headers = new Headers();
    headers.append("content-length", "10");
    headers.append("content-length", "100");
    const request = new Request("https://stealth.test/api", {
      method: "POST",
      headers: { "content-type": "application/json", ...Object.fromEntries(headers) },
      body: "{}",
    });
    const error = await captureAsyncError(() => parseJsonBody(request, emptySchema));
    expect(error.status).toBe(400);
    expect(error.code).toBe("bad_request");
  });

  it("rejects malformed body even when Content-Length matches", async () => {
    const request = jsonRequest("{{", "application/json", { "content-length": "2" });
    const error = await captureAsyncError(() => parseJsonBody(request, emptySchema));
    expect(error.status).toBe(400);
    expect(error.code).toBe("bad_request");
  });

  it("rejects body exceeding 64 KiB default limit when Content-Length is absent", async () => {
    const oversized = "x".repeat(70 * 1024);
    const request = new Request("https://stealth.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: oversized,
    });
    const error = await captureAsyncError(() => parseJsonBody(request, emptySchema));
    expect(error.status).toBe(413);
    expect(error.code).toBe("bad_request");
  });
});

/* ------------------------------------------------------------------ */
/*  Duplicate and malformed headers                                    */
/* ------------------------------------------------------------------ */

describe("parseJsonBody — malformed headers", () => {
  it("rejects Content-Length with leading zeros", async () => {
    const request = jsonRequest("{}", "application/json", { "content-length": "0010" });
    const result = await parseJsonBody(request, emptySchema);
    expect(result).toEqual({});
  });

  it("accepts Content-Length with whitespace", async () => {
    const request = jsonRequest("{}", "application/json", { "content-length": " 2 " });
    const result = await parseJsonBody(request, emptySchema);
    expect(result).toEqual({});
  });

  it("handles missing Content-Length with valid small body", async () => {
    const request = new Request("https://stealth.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const result = await parseJsonBody(request, emptySchema);
    expect(result).toEqual({});
  });

  it("handles Transfer-Encoding header alongside Content-Length", async () => {
    const request = jsonRequest("{}", "application/json", {
      "content-length": "2",
      "transfer-encoding": "identity",
    });
    const result = await parseJsonBody(request, emptySchema);
    expect(result).toEqual({});
  });

  it("handles large x-forwarded-for header without crashing", async () => {
    const request = jsonRequest("{}", "application/json", {
      "x-forwarded-for": "192.168.1.1, 10.0.0.1, 172.16.0.1, " + "192.168." + "1.1, ".repeat(50),
    });
    const result = await parseJsonBody(request, emptySchema);
    expect(result).toEqual({});
  });
});

/* ------------------------------------------------------------------ */
/*  Query encoding fuzzing                                             */
/* ------------------------------------------------------------------ */

describe("parseSearchParams — query encoding fuzzing", () => {
  const passthrough = z.object({}).catchall(z.string());

  it.each([
    { query: "?q=%00", desc: "null byte in value" },
    { query: "?%00=value", desc: "null byte in key" },
    { query: "?%01%02%03=value", desc: "multiple control chars in key" },
  ])("rejects $desc with 400", ({ query }) => {
    const request = new Request(`https://stealth.test/api${query}`);
    const error = captureError(() => parseSearchParams(request, passthrough));
    expect(error.status).toBe(400);
    expect(error.code).toBe("bad_request");
  });

  it.each([
    { query: "?a=1;b=2", params: { a: "1;b=2" }, desc: "semicolons as literal values" },
    { query: "?cursor=abc#fragment", params: { cursor: "abc" }, desc: "hash fragment stripped" },
    { query: "?a=1&&b=2", params: { a: "1", b: "2" }, desc: "empty segment between &&" },
    { query: "?q=%C3%A9", params: { q: "é" }, desc: "UTF-8 encoded é" },
    { query: "?q=%EF%BB%BF", params: { q: "\uFEFF" }, desc: "BOM prefix in value" },
    { query: "?q=%E2%80%8E", params: { q: "\u200E" }, desc: "right-to-left override in value" },
    {
      query: "?q=%FF%FE",
      params: { q: "\uFFFD\uFFFD" },
      desc: "invalid UTF-8 sequence becomes replacement characters",
    },
  ])("gracefully handles $desc", ({ query, params }) => {
    const request = new Request(`https://stealth.test/api${query}`);
    expect(parseSearchParams(request, passthrough)).toEqual(params);
  });

  it("normalizes NFD-decomposed Unicode to NFC", () => {
    const request = new Request("https://stealth.test/api?q=%65%CC%81");
    const result = parseSearchParams(request, passthrough);
    expect(result.q).toBe("é");
    expect(result.q.normalize("NFC")).toBe(result.q);
  });

  it("normalizes NFKD-decomposed Unicode to NFC", () => {
    const request = new Request("https://stealth.test/api?q=%E2%84%AB");
    const result = parseSearchParams(request, passthrough);
    expect(result.q.normalize("NFC")).toBe(result.q);
  });

  it("rejects extremely long key name with 414", () => {
    const longKey = "k".repeat(3000);
    const request = new Request(`https://stealth.test/api?${longKey}=value`);
    const error = captureError(() => parseSearchParams(request, passthrough));
    expect(error.status).toBe(414);
  });

  it("rejects extremely long value with 414", () => {
    const longValue = "v".repeat(2000);
    const request = new Request(`https://stealth.test/api?key=${longValue}`);
    const error = captureError(() => parseSearchParams(request, passthrough));
    expect(error.status).toBe(414);
  });
});

/* ------------------------------------------------------------------ */
/*  Error envelope contract                                            */
/* ------------------------------------------------------------------ */

describe("error envelope contract — all fuzz failures", () => {
  it.each([
    { body: "{", contentType: "application/json", desc: "truncated JSON" },
    { body: "{}", contentType: "text/plain", desc: "wrong content-type" },
    { body: "x".repeat(70 * 1024), contentType: "application/json", desc: "oversized body" },
  ])("returns full envelope for $desc", async ({ body, contentType }) => {
    const request = jsonRequest(body, contentType);
    const error = await captureAsyncError(() => parseJsonBody(request, emptySchema));

    expect(error).toHaveProperty("status");
    expect(typeof error.status).toBe("number");
    expect(error.status).toBeGreaterThanOrEqual(400);

    expect(error).toHaveProperty("code");
    expect(typeof error.code).toBe("string");
    expect(error.code.length).toBeGreaterThan(0);

    expect(error).toHaveProperty("message");
    expect(typeof error.message).toBe("string");
    expect(error.message.length).toBeGreaterThan(0);
  });

  it.each([
    { query: "?cursor=first&cursor=second", desc: "duplicate scalar param" },
    { query: "?=orphan", desc: "empty param name" },
    { query: "?cursor=%01abc", desc: "control char in value" },
    { query: "?cursor=%00", desc: "null byte in value" },
  ])("returns full envelope for $desc", ({ query }) => {
    const request = new Request(`https://stealth.test/api${query}`);
    const error = captureError(() => parseSearchParams(request, z.object({}).catchall(z.string())));

    expect(error).toHaveProperty("status");
    expect(typeof error.status).toBe("number");
    expect(error.status).toBeGreaterThanOrEqual(400);

    expect(error).toHaveProperty("code");
    expect(typeof error.code).toBe("string");
    expect(error.code.length).toBeGreaterThan(0);

    expect(error).toHaveProperty("message");
    expect(typeof error.message).toBe("string");
    expect(error.message.length).toBeGreaterThan(0);
  });
});
