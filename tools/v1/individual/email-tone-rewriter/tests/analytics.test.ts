/**
 * Tests for the analytics service.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  RewriteAnalytics,
  createAnalytics,
  compareReports,
  aggregateErrors,
  averageWordCount,
  mostChangedTone,
  mostTruncatedTone,
} from "../services/analytics";
import type { ToneRewrite } from "../services/emailToneRewriter";
import type { BatchResult } from "../services/batch";

function makeFakeRewrite(overrides: Partial<ToneRewrite> = {}): ToneRewrite {
  return {
    tone: "formal",
    rewrittenBody: "Please review the document.",
    preservedKeyPoints: ["Friday", "$500"],
    wordCount: 5,
    truncated: false,
    changed: true,
    actions: { canSend: false, canSave: false, canMutate: false },
    source: {
      subject: "Test",
      bodyText: "Hey, please review the document by Friday.",
    },
    ...overrides,
  };
}

describe("RewriteAnalytics", () => {
  let analytics: RewriteAnalytics;

  beforeEach(() => {
    analytics = createAnalytics();
  });

  it("starts with zero events", () => {
    expect(analytics.totalRewrites).toBe(0);
    expect(analytics.totalErrors).toBe(0);
    expect(analytics.errorRate).toBe(0);
  });

  it("records a rewrite event", () => {
    analytics.recordRewrite(makeFakeRewrite(), 10);
    expect(analytics.totalRewrites).toBe(1);
    expect(analytics.totalErrors).toBe(0);
  });

  it("records multiple rewrite events", () => {
    analytics.recordRewrite(makeFakeRewrite({ tone: "formal" }), 5);
    analytics.recordRewrite(makeFakeRewrite({ tone: "concise" }), 8);
    analytics.recordRewrite(makeFakeRewrite({ tone: "friendly" }), 12);
    expect(analytics.totalRewrites).toBe(3);
  });

  it("records an error", () => {
    analytics.recordError("empty-body");
    expect(analytics.totalErrors).toBe(1);
  });

  it("computes error rate correctly", () => {
    analytics.recordRewrite(makeFakeRewrite(), 5);
    analytics.recordError("empty-body");
    analytics.recordError("unsupported-tone");
    expect(analytics.errorRate).toBe(67);
  });

  it("computes average duration", () => {
    analytics.recordRewrite(makeFakeRewrite(), 10);
    analytics.recordRewrite(makeFakeRewrite(), 20);
    analytics.recordRewrite(makeFakeRewrite(), 30);
    expect(analytics.averageDurationMs).toBe(20);
  });

  it("returns 0 average duration with no events", () => {
    expect(analytics.averageDurationMs).toBe(0);
  });

  it("computes average word reduction", () => {
    const longRewrite = makeFakeRewrite({
      source: { subject: "Test", bodyText: "a b c d e f g h i j k l m n o p" },
      wordCount: 8,
    });
    analytics.recordRewrite(longRewrite, 5);
    expect(analytics.averageWordReduction).toBe(8);
  });

  it("returns most used tone", () => {
    analytics.recordRewrite(makeFakeRewrite({ tone: "formal" }), 5);
    analytics.recordRewrite(makeFakeRewrite({ tone: "concise" }), 5);
    analytics.recordRewrite(makeFakeRewrite({ tone: "formal" }), 5);
    expect(analytics.mostUsedTone).toBe("formal");
  });

  it("returns none when no events", () => {
    expect(analytics.mostUsedTone).toBe("none");
  });

  it("returns tone usage counts", () => {
    analytics.recordRewrite(makeFakeRewrite({ tone: "formal" }), 5);
    analytics.recordRewrite(makeFakeRewrite({ tone: "concise" }), 5);
    const counts = analytics.toneUsageCounts();
    expect(counts["formal"]).toBe(1);
    expect(counts["concise"]).toBe(1);
  });

  it("returns per-tone statistics", () => {
    analytics.recordRewrite(makeFakeRewrite({ tone: "formal", truncated: true }), 5);
    analytics.recordRewrite(makeFakeRewrite({ tone: "concise" }), 5);
    const stats = analytics.getToneStats();
    expect(stats.length).toBeGreaterThanOrEqual(2);
    const formalStats = stats.find((s) => s.tone === "formal");
    expect(formalStats).toBeDefined();
    expect(formalStats!.truncationRate).toBeGreaterThan(0);
  });

  it("returns hourly breakdown", () => {
    analytics.recordRewrite(makeFakeRewrite(), 5);
    const hours = analytics.getHourlyBreakdown();
    expect(Object.keys(hours).length).toBeGreaterThanOrEqual(1);
  });

  it("returns top key points", () => {
    analytics.recordRewrite(makeFakeRewrite(), 5);
    const top = analytics.getTopKeyPoints(5);
    expect(top.length).toBeGreaterThan(0);
    expect(top[0].point).toBeTruthy();
    expect(top[0].count).toBeGreaterThan(0);
  });

  it("returns performance by tone", () => {
    analytics.recordRewrite(makeFakeRewrite({ tone: "formal" }), 10);
    analytics.recordRewrite(makeFakeRewrite({ tone: "formal" }), 20);
    const perf = analytics.getPerformanceByTone();
    expect(perf["formal"]).toBeDefined();
    expect(perf["formal"].count).toBe(2);
    expect(perf["formal"].avgDurationMs).toBe(15);
  });

  it("generates a report", () => {
    analytics.recordRewrite(makeFakeRewrite(), 5);
    analytics.recordError("empty-body");
    const report = analytics.generateReport();
    expect(report.totalRewrites).toBe(1);
    expect(report.totalErrors).toBe(1);
    expect(report.toneStats.length).toBeGreaterThan(0);
  });

  it("returns usage summary", () => {
    analytics.recordRewrite(makeFakeRewrite({ tone: "formal" }), 5);
    analytics.recordRewrite(makeFakeRewrite({ tone: "concise" }), 5);
    const summary = analytics.getUsageSummary();
    expect(summary.totalRewrites).toBe(2);
    expect(summary.uniqueTonesUsed).toBeGreaterThanOrEqual(2);
    expect(summary.preferredTone).toBeTruthy();
  });

  it("resets all data", () => {
    analytics.recordRewrite(makeFakeRewrite(), 5);
    analytics.recordError("empty-body");
    analytics.reset();
    expect(analytics.totalRewrites).toBe(0);
    expect(analytics.totalErrors).toBe(0);
  });

  it("tracks uptime", () => {
    expect(analytics.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it("exports data", () => {
    analytics.recordRewrite(makeFakeRewrite(), 5);
    analytics.recordError("empty-body");
    const data = analytics.export();
    expect(data.events.length).toBe(1);
    expect(data.errors.length).toBe(1);
    expect(data.report).toBeDefined();
    expect(data.summary).toBeDefined();
  });

  it("records batch results", () => {
    const mockResults: BatchResult[] = [
      {
        index: 0,
        request: { subject: "", bodyText: "Hello", tone: "formal" },
        status: "success",
        rewrite: makeFakeRewrite(),
      },
      {
        index: 1,
        request: { subject: "", bodyText: "", tone: "friendly" },
        status: "error",
        code: "empty-body",
        message: "Body is empty",
      },
    ];
    analytics.recordBatch(mockResults, Date.now());
    expect(analytics.totalRewrites).toBe(1);
    expect(analytics.totalErrors).toBe(1);
  });
});

describe("createAnalytics", () => {
  it("creates a new instance", () => {
    const instance = createAnalytics();
    expect(instance).toBeInstanceOf(RewriteAnalytics);
    expect(instance.totalRewrites).toBe(0);
  });
});

describe("compareReports", () => {
  it("compares two reports and returns differences", () => {
    const analytics = createAnalytics();
    analytics.recordRewrite(makeFakeRewrite(), 5);
    const before = analytics.generateReport();
    analytics.recordRewrite(makeFakeRewrite(), 10);
    analytics.recordRewrite(makeFakeRewrite(), 15);
    const after = analytics.generateReport();
    const diffs = compareReports(before, after);
    expect(diffs.rewrites).toBe("+1");
    expect(diffs.errors).toBe("+0");
  });
});

describe("aggregateErrors", () => {
  it("aggregates error codes across sessions", () => {
    const sessions = [
      { errors: [{ code: "empty-body" }, { code: "unsupported-tone" }] },
      { errors: [{ code: "empty-body" }] },
    ];
    const result = aggregateErrors(sessions);
    expect(result["empty-body"]).toBe(2);
    expect(result["unsupported-tone"]).toBe(1);
  });
});

describe("averageWordCount", () => {
  it("returns 0 for empty report", () => {
    const analytics = createAnalytics();
    const report = analytics.generateReport();
    expect(averageWordCount(report)).toBe(0);
  });

  it("computes average word count", () => {
    const analytics = createAnalytics();
    analytics.recordRewrite(makeFakeRewrite({ wordCount: 5 }), 5);
    analytics.recordRewrite(makeFakeRewrite({ wordCount: 10 }), 5);
    const report = analytics.generateReport();
    const avg = averageWordCount(report);
    expect(avg).toBeGreaterThan(0);
  });
});

describe("mostChangedTone", () => {
  it("returns the tone with highest change rate", () => {
    const analytics = createAnalytics();
    analytics.recordRewrite(makeFakeRewrite({ tone: "formal", changed: true }), 5);
    analytics.recordRewrite(makeFakeRewrite({ tone: "concise", changed: false }), 5);
    const report = analytics.generateReport();
    const tone = mostChangedTone(report);
    expect(tone).toBeTruthy();
  });

  it("returns none for empty report", () => {
    const analytics = createAnalytics();
    const report = analytics.generateReport();
    expect(mostChangedTone(report)).toBe("none");
  });
});

describe("mostTruncatedTone", () => {
  it("returns the tone with highest truncation rate", () => {
    const analytics = createAnalytics();
    analytics.recordRewrite(makeFakeRewrite({ tone: "formal", truncated: true }), 5);
    analytics.recordRewrite(makeFakeRewrite({ tone: "concise", truncated: false }), 5);
    const report = analytics.generateReport();
    const tone = mostTruncatedTone(report);
    expect(tone).toBeTruthy();
  });

  it("returns none for empty report", () => {
    const analytics = createAnalytics();
    const report = analytics.generateReport();
    expect(mostTruncatedTone(report)).toBe("none");
  });
});
