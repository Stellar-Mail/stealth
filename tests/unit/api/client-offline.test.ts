import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClient, ApiClientError } from "@/lib/api";

describe("ApiClient offline fail-fast (BETA-071)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws an offline error without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ isOnline: () => false });

    await expect(client.get("/mailbox/sync")).rejects.toSatisfy((error: unknown) => {
      return error instanceof ApiClientError && error.code === "offline" && error.retryable;
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
