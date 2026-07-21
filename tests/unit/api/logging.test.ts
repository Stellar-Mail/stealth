import { describe, expect, it } from "vitest";

import { planApiLog, shouldSampleRoutineSuccess } from "../../../src/server/api/logging";

describe("API log sampling", () => {
  it("keeps deterministic sampling decisions per route and request ID", () => {
    const decisions = Array.from({ length: 5 }, () =>
      shouldSampleRoutineSuccess("/postage/quote", "request-123", { successSampleRate: 0.25 }),
    );

    expect(new Set(decisions).size).toBe(1);
  });

  it("allows routine success logs to be sampled by configured rate", () => {
    expect(shouldSampleRoutineSuccess("/health", "request-1", { successSampleRate: 0 })).toBe(
      false,
    );
    expect(shouldSampleRoutineSuccess("/health", "request-1", { successSampleRate: 1 })).toBe(true);
  });

  it("never samples out security denials or unexpected errors", () => {
    expect(
      planApiLog(
        {
          route: "/policies/owner",
          requestId: "request-1",
          status: 403,
          outcome: "security_denied",
        },
        { successSampleRate: 0 },
      ).log,
    ).toMatchObject({ outcome: "security_denied", samplingRate: 1 });

    expect(
      planApiLog(
        { route: "/postage", requestId: "request-2", status: 500, outcome: "unexpected_error" },
        { successSampleRate: 0 },
      ).log,
    ).toMatchObject({ outcome: "unexpected_error", samplingRate: 1 });
  });

  it("counts metrics for all requests even when routine success logs are not emitted", () => {
    const decision = planApiLog(
      { route: "/health", requestId: "request-3", status: 200, outcome: "success" },
      { successSampleRate: 0 },
    );

    expect(decision.log).toBeUndefined();
    expect(decision.metrics).toEqual([
      { metric: "api.requests_total", route: "/health", status: 200, outcome: "success" },
    ]);
  });
});
