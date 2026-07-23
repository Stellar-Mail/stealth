import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";

// This mirrors the reimplementation approach used in response-time.test.mjs:
// the real contract lives in ../services/execution-contract.ts (TypeScript),
// and this file re-implements its logic in plain JS against the same JSON
// fixtures so the isolated tool folder can be tested with Node's built-in
// test runner, with no TS loader/build step required.

const sampleEntries = JSON.parse(
  fs.readFileSync(new URL("../fixtures/sample-response-times.json", import.meta.url), "utf-8"),
);
const sampleMembers = JSON.parse(
  fs.readFileSync(new URL("../fixtures/team-members.json", import.meta.url), "utf-8"),
);
const contractCases = JSON.parse(
  fs.readFileSync(new URL("../fixtures/execution-contract-cases.json", import.meta.url), "utf-8"),
);

const SLA_MS = 14400000;

function calculateMetrics(entries) {
  if (entries.length === 0) {
    return {
      averageResponseTimeMs: 0,
      medianResponseTimeMs: 0,
      fastestResponseTimeMs: 0,
      slowestResponseTimeMs: 0,
      totalResponses: 0,
      metCount: 0,
      missedCount: 0,
      breachedCount: 0,
      slaMs: SLA_MS,
      withinSLAPercentage: 0,
    };
  }

  const sorted = [...entries].sort((a, b) => a.responseTimeMs - b.responseTimeMs);
  const total = sorted.length;
  const mid = Math.floor(total / 2);

  return {
    averageResponseTimeMs: Math.round(entries.reduce((s, e) => s + e.responseTimeMs, 0) / total),
    medianResponseTimeMs:
      total % 2 === 0
        ? Math.round((sorted[mid - 1].responseTimeMs + sorted[mid].responseTimeMs) / 2)
        : sorted[mid].responseTimeMs,
    fastestResponseTimeMs: sorted[0].responseTimeMs,
    slowestResponseTimeMs: sorted[total - 1].responseTimeMs,
    totalResponses: total,
    metCount: entries.filter((e) => e.status === "met").length,
    missedCount: entries.filter((e) => e.status === "missed").length,
    breachedCount: entries.filter((e) => e.status === "breached").length,
    slaMs: SLA_MS,
    withinSLAPercentage: Math.round(
      (entries.filter((e) => e.status === "met").length / total) * 100,
    ),
  };
}

function filterByDateRange(entries, range) {
  const start = new Date(range.start).getTime();
  const endExclusive = new Date(range.end).getTime() + 86400000;
  return entries.filter((e) => {
    const sent = new Date(e.sentAt).getTime();
    return sent >= start && sent < endExclusive;
  });
}

function isValidRange(range) {
  const start = new Date(range.start).getTime();
  const end = new Date(range.end).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && start <= end;
}

// Plain-JS mirror of createResponseTimeService from response-time-service.ts.
function createResponseTimeService(config = {}) {
  const { simulateDelay = true, delayMs = 800, failureRate = 0 } = config;
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function getEntries(range) {
    if (simulateDelay) await delay(delayMs);
    if (Math.random() < failureRate) {
      throw new Error("Failed to load response time entries.");
    }
    let entries = sampleEntries;
    if (range) entries = filterByDateRange(entries, range);
    return entries;
  }

  async function getTeamMembers() {
    if (simulateDelay) await delay(delayMs / 2);
    return sampleMembers;
  }

  async function getMetrics(range) {
    const entries = await getEntries(range);
    return calculateMetrics(entries);
  }

  return { getEntries, getTeamMembers, getMetrics };
}

// Plain-JS mirror of runResponseTimeQuery from execution-contract.ts.
async function runResponseTimeQuery(input = {}, config = {}) {
  if (input.range && !isValidRange(input.range)) {
    return {
      ok: false,
      error: {
        code: "INVALID_DATE_RANGE",
        message: `Invalid date range: start (${input.range.start}) must not be after end (${input.range.end}).`,
      },
    };
  }

  const service = createResponseTimeService(config);

  try {
    const [entries, metrics, teamMembers] = await Promise.all([
      service.getEntries(input.range),
      service.getMetrics(input.range),
      service.getTeamMembers(),
    ]);
    return { ok: true, data: { entries, metrics, teamMembers } };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "FETCH_FAILED",
        message: err instanceof Error ? err.message : "Failed to load response time data.",
      },
    };
  }
}

describe("Response Time Tracker — Execution Contract", () => {
  describe("success cases", () => {
    for (const testCase of contractCases.successCases) {
      it(testCase.name, async () => {
        const result = await runResponseTimeQuery(testCase.input, { simulateDelay: false });
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.data.metrics.totalResponses, testCase.expect.totalResponses);
        assert.strictEqual(result.data.entries.length, testCase.expect.totalResponses);
        assert.strictEqual(result.data.teamMembers.length, testCase.expect.teamMemberCount);
      });
    }
  });

  describe("failure cases", () => {
    for (const testCase of contractCases.failureCases) {
      it(testCase.name, async () => {
        const result = await runResponseTimeQuery(testCase.input, testCase.config ?? {});
        assert.strictEqual(result.ok, false);
        assert.strictEqual(result.error.code, testCase.expectErrorCode);
        assert.ok(typeof result.error.message === "string" && result.error.message.length > 0);
      });
    }
  });

  describe("result shape", () => {
    it("never throws, even on service failure", async () => {
      await assert.doesNotReject(async () => {
        await runResponseTimeQuery({}, { simulateDelay: false, failureRate: 1 });
      });
    });

    it("success and failure results are mutually exclusive", async () => {
      const success = await runResponseTimeQuery({}, { simulateDelay: false });
      assert.strictEqual("data" in success, true);
      assert.strictEqual("error" in success, false);

      const failure = await runResponseTimeQuery(
        { range: { start: "2026-06-15", end: "2026-06-10" } },
        { simulateDelay: false },
      );
      assert.strictEqual("error" in failure, true);
      assert.strictEqual("data" in failure, false);
    });
  });
});
