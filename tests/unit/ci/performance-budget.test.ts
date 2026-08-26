import { describe, expect, it } from "vitest";
import { evaluateBudget } from "../../load/budget";
import type { LoadTestResult } from "../../load/harness";

const budget = {
  maxFailureRate: 0.1,
  maxP90Ms: 100,
  maxP99Ms: 200,
  minRateLimitHits: 1,
};

function result(overrides: Partial<LoadTestResult> = {}): LoadTestResult {
  return {
    latenciesMs: [10, 20, 30, 40],
    statusCodes: { 200: 10 },
    totalRequests: 10,
    successes: 10,
    failures: 0,
    networkErrors: 0,
    durationMs: 100,
    resource: {
      heapUsedBytes: 0,
      externalBytes: 0,
      rssBytes: 0,
      cpuUserMicros: 0,
      cpuSystemMicros: 0,
    },
    ...overrides,
  };
}

describe("BETA-083 performance budget", () => {
  it("passes when latency, errors, and successes are within budget", () => {
    expect(evaluateBudget("ok", result(), { budget }).ok).toBe(true);
  });

  it("fails when latency is above threshold", () => {
    expect(() =>
      evaluateBudget("slow", result({ latenciesMs: [10, 20, 30, 500] }), { budget }),
    ).toThrow(/exceeded budget/);
  });

  it("fails when error rate is above threshold", () => {
    expect(() =>
      evaluateBudget(
        "errors",
        result({ successes: 5, failures: 5, statusCodes: { 200: 5, 500: 5 } }),
        { budget },
      ),
    ).toThrow(/failure rate/);
  });

  it("fails when all requests fail", () => {
    expect(() =>
      evaluateBudget(
        "dead",
        result({ successes: 0, failures: 10, statusCodes: { 500: 10 }, latenciesMs: [10] }),
        { budget },
      ),
    ).toThrow(/all requests failing/);
  });

  it("fails when required rate-limit control is missing", () => {
    expect(() => evaluateBudget("limits", result(), { budget, requireRateLimit: true })).toThrow(
      /429/,
    );
  });

  it("fails when a scenario returns an unapproved status", () => {
    expect(() =>
      evaluateBudget("unexpected", result({ statusCodes: { 200: 9, 503: 1 } }), {
        budget,
        allowedStatuses: [200],
      }),
    ).toThrow(/unexpected status codes 503/);
  });
});
