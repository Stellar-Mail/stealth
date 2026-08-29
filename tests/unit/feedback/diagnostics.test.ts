import { afterEach, describe, expect, it, vi } from "vitest";

import {
  configuredFeatureFlags,
  collectFeedbackDiagnostics,
  currentSafeRoute,
  summarizeBrowser,
} from "@/features/feedback/diagnostics";

describe("BETA-096 feedback diagnostic allowlist", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("summarizes browser family, major version, and OS without retaining the raw user-agent", () => {
    const raw =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "Chrome/140.0.0.0 Safari/537.36 unique-device-fragment";
    const summary = summarizeBrowser(raw);
    expect(summary).toBe("Chrome 140 / Windows");
    expect(summary).not.toContain("unique-device-fragment");
    expect(summary).not.toContain("Mozilla");
  });

  it("drops query strings and replaces dynamic identifiers in routes", () => {
    const stellarAddress = `G${"A".repeat(55)}`;
    expect(currentSafeRoute({ pathname: `/mail/${stellarAddress}` } as Location)).toBe(
      "/mail/:address",
    );
    expect(
      currentSafeRoute({ pathname: "/messages/0123456789abcdef0123456789abcdef" } as Location),
    ).toBe("/messages/:id");
    expect(
      currentSafeRoute({ pathname: "/messages/550e8400-e29b-41d4-a716-446655440000" } as Location),
    ).toBe("/messages/:id");
  });

  it("keeps only repository-approved feature flag names", () => {
    expect(
      configuredFeatureFlags(
        "operator-feedback,secret-experiment,live-mailbox,operator-feedback,token-rollout",
      ),
    ).toEqual(["live-mailbox", "operator-feedback"]);
  });

  it("maps the real liveness response to the safe healthy service status", async () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
    });
    vi.stubGlobal("window", {
      location: { pathname: "/inbox" },
      sessionStorage: { getItem: () => null },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ data: { status: "ok" } }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    await expect(collectFeedbackDiagnostics()).resolves.toMatchObject({
      browser: "Chrome 140 / Windows",
      route: "/inbox",
      serviceStatus: "healthy",
    });
  });
});
