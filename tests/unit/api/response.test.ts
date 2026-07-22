import { describe, expect, it } from "vitest";

import { ApiError } from "../../../src/server/api/errors";
import {
  JSON_SECURITY_HEADERS,
  apiFailure,
  apiSuccess,
  handleApiRequest,
  jsonResponse,
} from "../../../src/server/api/response";

describe("API response envelopes", () => {
  it("preserves a caller-provided request ID", async () => {
    const request = new Request("https://stealth.test/api", {
      headers: { "x-request-id": "request-123" },
    });

    const response = apiSuccess(request, { ready: true });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("request-123");
    expect(await response.json()).toMatchObject({
      data: { ready: true },
      meta: { requestId: "request-123" },
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
    expect(response.headers.get("x-request-id")).toBe("request-123");
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
