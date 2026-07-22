import { describe, expect, it } from "vitest";

import { ApiError } from "../../../src/server/api/errors";
import {
  CORRELATION_ID_HEADER,
  JSON_SECURITY_HEADERS,
  MAX_CORRELATION_ID_LENGTH,
  apiFailure,
  apiSuccess,
  handleApiRequest,
  jsonResponse,
  validateCorrelationId,
} from "../../../src/server/api/response";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("API response envelopes", () => {
  it("always generates a server-owned request ID even when none is supplied", async () => {
    const request = new Request("https://stealth.test/api");

    const response = apiSuccess(request, { ready: true });
    const body = (await response.json()) as { meta: { requestId: string } };

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toMatch(UUID_PATTERN);
    expect(body.meta.requestId).toMatch(UUID_PATTERN);
    expect(body.meta.requestId).toBe(response.headers.get("x-request-id"));
  });

  it("never lets a client x-request-id replace the server request ID", async () => {
    const request = new Request("https://stealth.test/api", {
      headers: { "x-request-id": "client-supplied-123" },
    });

    const response = apiSuccess(request, { ready: true });
    const body = (await response.json()) as {
      meta: { requestId: string; correlationId?: string };
    };

    // The server ID is a fresh UUID, not the client's value.
    expect(response.headers.get("x-request-id")).toMatch(UUID_PATTERN);
    expect(response.headers.get("x-request-id")).not.toBe("client-supplied-123");
    expect(body.meta.requestId).not.toBe("client-supplied-123");
    // The valid client value is preserved separately as a correlation ID.
    expect(body.meta.correlationId).toBe("client-supplied-123");
    expect(response.headers.get(CORRELATION_ID_HEADER)).toBe("client-supplied-123");
  });

  it("generates a unique request ID per request", () => {
    const first = apiSuccess(new Request("https://stealth.test/api"), { ok: true });
    const second = apiSuccess(new Request("https://stealth.test/api"), { ok: true });

    expect(first.headers.get("x-request-id")).not.toBe(second.headers.get("x-request-id"));
  });

  it("omits correlation metadata when no valid client correlation ID is supplied", async () => {
    const response = apiSuccess(new Request("https://stealth.test/api"), { ready: true });
    const body = (await response.json()) as { meta: Record<string, unknown> };

    expect(body.meta.correlationId).toBeUndefined();
    expect(response.headers.get(CORRELATION_ID_HEADER)).toBeNull();
  });

  it.each([
    ["oversized", "x".repeat(MAX_CORRELATION_ID_LENGTH + 1)],
    ["whitespace-only", "   "],
    ["header-folded duplicates", "id-1, id-2"],
    ["disallowed characters", "id with spaces"],
  ])("ignores a malformed client correlation ID (%s)", async (_label, value) => {
    const request = new Request("https://stealth.test/api", {
      headers: { "x-request-id": value },
    });

    const response = apiSuccess(request, { ready: true });
    const body = (await response.json()) as {
      meta: { requestId: string; correlationId?: string };
    };

    expect(response.headers.get("x-request-id")).toMatch(UUID_PATTERN);
    expect(body.meta.correlationId).toBeUndefined();
    expect(response.headers.get(CORRELATION_ID_HEADER)).toBeNull();
  });

  it("propagates a valid client correlation ID onto error responses too", async () => {
    const request = new Request("https://stealth.test/api", {
      headers: { "x-request-id": "corr-42" },
    });

    const response = apiFailure(request, new ApiError(400, "bad_request", "Invalid request"));
    const body = (await response.json()) as {
      meta: { requestId: string; correlationId?: string };
    };

    expect(response.status).toBe(400);
    expect(response.headers.get("x-request-id")).toMatch(UUID_PATTERN);
    expect(response.headers.get("x-request-id")).not.toBe("corr-42");
    expect(body.meta.correlationId).toBe("corr-42");
    expect(response.headers.get(CORRELATION_ID_HEADER)).toBe("corr-42");
  });

  describe("validateCorrelationId", () => {
    it.each([
      ["a-valid.token_1~2", "a-valid.token_1~2"],
      ["trims surrounding whitespace", "  trimmed-id  ", "trimmed-id"],
    ])("accepts %s", (_label, input, expected = input) => {
      expect(validateCorrelationId(input)).toBe(expected);
    });

    it.each([
      ["null", null],
      ["undefined", undefined],
      ["empty", ""],
      ["oversized", "x".repeat(MAX_CORRELATION_ID_LENGTH + 1)],
      ["comma", "a,b"],
      ["control char", "a\tb"],
    ])("rejects %s", (_label, input) => {
      expect(validateCorrelationId(input)).toBeUndefined();
    });
  });

  it("maps typed errors into a stable JSON shape", async () => {
    const request = new Request("https://stealth.test/api");
    const response = apiFailure(
      request,
      new ApiError(409, "conflict", "The resource already exists"),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: {
        code: "conflict",
        message: "The resource already exists",
        retryable: true,
        retryClassification: "conflict",
      },
    });
  });

  it.each([
    ["success", () => apiSuccess(new Request("https://stealth.test/api"), { ready: true })],
    [
      "failure",
      () =>
        apiFailure(
          new Request("https://stealth.test/api"),
          new ApiError(400, "bad_request", "Invalid request"),
        ),
    ],
    ["raw JSON", () => jsonResponse(new Request("https://stealth.test/api"), { openapi: "3.1.0" })],
  ])("adds mandatory security headers to every %s response", (_kind, createResponse) => {
    const response = createResponse();

    for (const [name, value] of Object.entries(JSON_SECURITY_HEADERS)) {
      expect(response.headers.get(name)).toBe(value);
    }
  });

  it("preserves existing and CORS headers while enforcing mandatory response headers", () => {
    const request = new Request("https://stealth.test/api", {
      headers: { "x-request-id": "request-123" },
    });
    const response = apiSuccess(
      request,
      { ready: true },
      {
        cachePolicy: "PUBLIC_REVALIDATE",
        headers: {
          "access-control-allow-origin": "https://client.example",
          etag: '"response-v1"',
          "x-content-type-options": "caller-value",
        },
      },
    );

    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    expect(response.headers.get("x-request-id")).toMatch(UUID_PATTERN);
    expect(response.headers.get(CORRELATION_ID_HEADER)).toBe("request-123");
    expect(response.headers.get("access-control-allow-origin")).toBe("https://client.example");
    expect(response.headers.get("etag")).toBe('"response-v1"');
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("restores mandatory headers removed by route-specific response logic", async () => {
    const request = new Request("https://stealth.test/api");
    const response = await handleApiRequest(request, () => {
      const routeResponse = apiSuccess(
        request,
        { ready: true },
        {
          headers: { "access-control-allow-origin": "*" },
        },
      );
      routeResponse.headers.delete("x-content-type-options");
      return routeResponse;
    });

    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("handles rate limit errors and exposes retry-after metadata in body and headers", async () => {
    const request = new Request("https://stealth.test/api");
    const response = apiFailure(
      request,
      new ApiError(429, "too_many_requests", "Rate limit exceeded", { retryAfterSeconds: 60 }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(await response.json()).toMatchObject({
      error: {
        code: "too_many_requests",
        message: "Rate limit exceeded",
        retryable: true,
        retryClassification: "rate_limit",
        retryAfter: 60,
      },
    });
  });
});
