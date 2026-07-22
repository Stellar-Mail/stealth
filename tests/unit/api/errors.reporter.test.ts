import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";

import {
  ApiError,
  normalizeApiError,
  registerErrorReporter,
  getErrorReporter,
} from "../../../src/server/api/errors";
import { apiFailure } from "../../../src/server/api/response";

describe("Internal Error Reporter", () => {
  beforeEach(() => {
    registerErrorReporter(null as any);
  });

  afterEach(() => {
    registerErrorReporter(null as any);
  });

  it("registers and retrieves the reporter", () => {
    const reporter = vi.fn();
    registerErrorReporter(reporter);
    expect(getErrorReporter()).toBe(reporter);
  });

  it("invokes reporter for unexpected errors with request ID and route ID", async () => {
    const reporter = vi.fn();
    registerErrorReporter(reporter);

    const unexpectedError = new Error("Something database went wrong");
    const request = new Request("https://stealth.test/api/v1/some-route", {
      headers: { "x-request-id": "test-req-id-123" },
    });

    const response = apiFailure(request, unexpectedError);
    const body = await response.json();

    // The reporter should be invoked once with the original error and context
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledWith(unexpectedError, {
      requestId: "test-req-id-123",
      routeId: "/api/v1/some-route",
    });

    // Public responses never contain stack traces or internal messages.
    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      error: {
        code: "internal_error",
        message: "An unexpected server error occurred",
      },
      meta: {
        requestId: "test-req-id-123",
      },
    });
    expect(JSON.stringify(body)).not.toContain("Something database went wrong");
  });

  it("does not classify known ApiError instances as unexpected", async () => {
    const reporter = vi.fn();
    registerErrorReporter(reporter);

    const knownError = new ApiError(404, "not_found", "Item does not exist");
    const request = new Request("https://stealth.test/api/v1/some-route");

    const response = apiFailure(request, knownError);
    await response.json();

    expect(reporter).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
  });

  it("does not classify validation ZodErrors as unexpected", async () => {
    const reporter = vi.fn();
    registerErrorReporter(reporter);

    const schema = z.object({ value: z.number() });
    const parsed = schema.safeParse({ value: "not-a-number" });
    expect(parsed.success).toBe(false);

    const request = new Request("https://stealth.test/api/v1/some-route");
    const response = apiFailure(request, parsed.error);
    await response.json();

    expect(reporter).not.toHaveBeenCalled();
    expect(response.status).toBe(422);
  });

  it("ensures reporter failures (sync throw) cannot replace the original response", async () => {
    const throwingReporter = vi.fn().mockImplementation(() => {
      throw new Error("Reporter sync crash!");
    });
    registerErrorReporter(throwingReporter);

    const unexpectedError = new Error("Database offline");
    const request = new Request("https://stealth.test/api/v1/some-route");

    const response = apiFailure(request, unexpectedError);
    const body = await response.json();

    expect(throwingReporter).toHaveBeenCalled();
    expect(response.status).toBe(500);
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).toBe("An unexpected server error occurred");
  });

  it("ensures reporter failures (async rejection) cannot replace the original response", async () => {
    const throwingReporter = vi.fn().mockRejectedValue(new Error("Reporter async crash!"));
    registerErrorReporter(throwingReporter);

    const unexpectedError = new Error("Database offline");
    const request = new Request("https://stealth.test/api/v1/some-route");

    const response = apiFailure(request, unexpectedError);
    const body = await response.json();

    expect(throwingReporter).toHaveBeenCalled();
    expect(response.status).toBe(500);
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).toBe("An unexpected server error occurred");
  });
});
