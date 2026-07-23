import { describe, expect, it } from "vitest";

import { ApiError } from "../../../src/server/api/errors";
import { CACHE_POLICIES, apiFailure, apiSuccess } from "../../../src/server/api/response";

describe("API response cache policies", () => {
  it("defaults to no-store when no cache policy is specified", () => {
    const response = apiSuccess(new Request("https://stealth.test/api"), { ready: true });

    expect(response.headers.get("cache-control")).toBe(CACHE_POLICIES.NO_STORE);
  });

  it.each([
    ["NO_STORE", CACHE_POLICIES.NO_STORE],
    ["PUBLIC_5_MINUTES", CACHE_POLICIES.PUBLIC_5_MINUTES],
    ["PUBLIC_IMMUTABLE", CACHE_POLICIES.PUBLIC_IMMUTABLE],
    ["PUBLIC_REVALIDATE", CACHE_POLICIES.PUBLIC_REVALIDATE],
  ] as const)("applies the %s cache policy", (cachePolicy, expected) => {
    const response = apiSuccess(
      new Request("https://stealth.test/api"),
      { ready: true },
      { cachePolicy },
    );

    expect(response.headers.get("cache-control")).toBe(expected);
  });

  it("preserves validators for responses that explicitly revalidate", () => {
    const response = apiSuccess(
      new Request("https://stealth.test/api"),
      { version: 1 },
      {
        cachePolicy: "PUBLIC_REVALIDATE",
        headers: { etag: '"metadata-v1"' },
      },
    );

    expect(response.headers.get("cache-control")).toBe(CACHE_POLICIES.PUBLIC_REVALIDATE);
    expect(response.headers.get("etag")).toBe('"metadata-v1"');
  });

  it("rejects cache-control headers that contradict the selected policy", () => {
    expect(() =>
      apiSuccess(
        new Request("https://stealth.test/api"),
        { ready: true },
        {
          cachePolicy: "NO_STORE",
          headers: { "cache-control": "no-store, public, max-age=3600" },
        },
      ),
    ).toThrow(/conflicting directives/);
  });

  it("keeps failure responses private", () => {
    const response = apiFailure(
      new Request("https://stealth.test/api"),
      new ApiError(401, "unauthorized", "Authentication required"),
    );

    expect(response.headers.get("cache-control")).toBe(CACHE_POLICIES.NO_STORE);
  });
});
