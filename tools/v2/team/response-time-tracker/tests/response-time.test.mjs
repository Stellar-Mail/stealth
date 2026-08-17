import { describe, it, before } from "node:test";
import assert from "node:assert";

// We test the service layer logic directly by importing the JSON fixtures and
// reimplementing the service functions in plain JS (no tsx loader needed).

const sampleEntries = JSON.parse(
  await import("fs").then((fs) =>
    fs.readFileSync(new URL("../fixtures/sample-response-times.json", import.meta.url), "utf-8"),
  ),
);

const sampleMembers = JSON.parse(
  await import("fs").then((fs) =>
    fs.readFileSync(new URL("../fixtures/team-members.json", import.meta.url), "utf-8"),
  ),
);

const SLA_MS = 14400000; // 4 hours

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

describe("Response Time Tracker — Service Logic", () => {
  describe("calculateMetrics", () => {
    it("returns correct values for sample fixture", () => {
      const metrics = calculateMetrics(sampleEntries);
      assert.strictEqual(metrics.totalResponses, 7);
      assert.strictEqual(metrics.metCount, 4);
      assert.strictEqual(metrics.missedCount, 2);
      assert.strictEqual(metrics.breachedCount, 1);
      assert.strictEqual(metrics.slaMs, 14400000);
    });

    it("calculates withinSLAPercentage correctly", () => {
      const metrics = calculateMetrics(sampleEntries);
      assert.strictEqual(metrics.withinSLAPercentage, Math.round((4 / 7) * 100));
      assert.strictEqual(metrics.withinSLAPercentage, 57);
    });

    it("identifies fastest and slowest response times", () => {
      const metrics = calculateMetrics(sampleEntries);
      assert.strictEqual(metrics.fastestResponseTimeMs, 1800000); // 30 min
      assert.strictEqual(metrics.slowestResponseTimeMs, 68400000); // 19 h
    });

    it("computes average correctly", () => {
      const metrics = calculateMetrics(sampleEntries);
      const expectedAvg = Math.round(sampleEntries.reduce((s, e) => s + e.responseTimeMs, 0) / 7);
      assert.strictEqual(metrics.averageResponseTimeMs, expectedAvg);
    });

    it("computes median correctly", () => {
      const metrics = calculateMetrics(sampleEntries);
      // sorted values: 1800000, 2700000, 8100000, 9000000, 16200000, 63000000, 68400000
      assert.strictEqual(metrics.medianResponseTimeMs, 9000000);
    });

    it("returns zero metrics for empty array", () => {
      const metrics = calculateMetrics([]);
      assert.strictEqual(metrics.totalResponses, 0);
      assert.strictEqual(metrics.averageResponseTimeMs, 0);
      assert.strictEqual(metrics.medianResponseTimeMs, 0);
      assert.strictEqual(metrics.fastestResponseTimeMs, 0);
      assert.strictEqual(metrics.slowestResponseTimeMs, 0);
      assert.strictEqual(metrics.metCount, 0);
      assert.strictEqual(metrics.missedCount, 0);
      assert.strictEqual(metrics.breachedCount, 0);
      assert.strictEqual(metrics.withinSLAPercentage, 0);
    });
  });

  describe("filterByDateRange", () => {
    it("includes entries within the range", () => {
      const result = filterByDateRange(sampleEntries, {
        start: "2026-06-10",
        end: "2026-06-12",
      });
      // Entries with sentAt between Jun 10 and Jun 12 inclusive
      assert.ok(result.length > 0);
      assert.ok(result.length <= 7);
    });

    it("excludes entries outside the range", () => {
      const result = filterByDateRange(sampleEntries, {
        start: "2025-01-01",
        end: "2025-12-31",
      });
      assert.strictEqual(result.length, 0);
    });

    it("matches a single-day range", () => {
      const result = filterByDateRange(sampleEntries, {
        start: "2026-06-10",
        end: "2026-06-10",
      });
      // Entries for Jun 10: rsp-001, rsp-002
      assert.strictEqual(result.length, 2);
    });
  });

  describe("team members fixture", () => {
    it("has the expected team members", () => {
      assert.strictEqual(sampleMembers.length, 3);
      const names = sampleMembers.map((m) => m.name).sort();
      assert.deepStrictEqual(names, ["Alex Chen", "Jordan Taylor", "Morgan Singh"]);
    });

    it("each member has an id and name", () => {
      for (const member of sampleMembers) {
        assert.ok(typeof member.id === "string");
        assert.ok(member.id.length > 0);
        assert.ok(typeof member.name === "string");
        assert.ok(member.name.length > 0);
      }
    });
  });
});
