import { describe, expect, it } from "vitest";

import { ApiError } from "../../../src/server/api/errors";
import { apiFailure, apiSuccess } from "../../../src/server/api/response";

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
