/**
 * Email Tone Rewriter — analytics and usage tracking service.
 *
 * Collects deterministic statistics about rewrite operations: tone usage
 * frequency, word count distributions, error rates, and performance metrics.
 * Pure service: no side effects, no network calls, no persistence.
 */

import type { ToneRewrite, RewriterErrorCode } from "./emailToneRewriter";
import type { BatchResult } from "./batch";

export interface RewriteEvent {
  timestamp: number;
  tone: string;
  originalWordCount: number;
  rewrittenWordCount: number;
  wordDelta: number;
  changed: boolean;
  truncated: boolean;
  durationMs: number;
  keyPointCount: number;
}

export interface ToneStats {
  tone: string;
  totalRewrites: number;
  totalWordsOriginal: number;
  totalWordsRewritten: number;
  averageReduction: number;
  averageKeyPoints: number;
  truncationRate: number;
  changeRate: number;
}

export interface AnalyticsReport {
  totalRewrites: number;
  totalErrors: number;
  errorRate: number;
  averageDurationMs: number;
  averageWordReduction: number;
  mostUsedTone: string;
  toneStats: ToneStats[];
  hourlyBreakdown: Record<string, number>;
  topKeyPoints: Map<string, number>;
  performanceByTone: Record<string, { avgDurationMs: number; count: number }>;
}

export interface UsageSummary {
  totalRewrites: number;
  uniqueTonesUsed: number;
  totalWordsProcessed: number;
  totalWordsSaved: number;
  averageConfidence: number;
  mostProductiveHour: number;
  preferredTone: string;
}

export class RewriteAnalytics {
  private events: RewriteEvent[] = [];
  private errors: Array<{ code: string; timestamp: number }> = [];
  private keyPointFrequency: Map<string, number> = new Map();
  private startTime: number = Date.now();

  /**
   * Records a successful rewrite event.
   */
  recordRewrite(rewrite: ToneRewrite, durationMs: number): void {
    const originalWords = rewrite.source.bodyText.split(/\s+/).filter(Boolean).length;
    const rewrittenWords = rewrite.wordCount;

    const event: RewriteEvent = {
      timestamp: Date.now(),
      tone: rewrite.tone,
      originalWordCount: originalWords,
      rewrittenWordCount: rewrittenWords,
      wordDelta: originalWords - rewrittenWords,
      changed: rewrite.changed,
      truncated: rewrite.truncated,
      durationMs,
      keyPointCount: rewrite.preservedKeyPoints.length,
    };

    this.events.push(event);

    for (const point of rewrite.preservedKeyPoints) {
      this.keyPointFrequency.set(point, (this.keyPointFrequency.get(point) || 0) + 1);
    }
  }

  /**
   * Records a rewrite error.
   */
  recordError(code: string): void {
    this.errors.push({ code, timestamp: Date.now() });
  }

  /**
   * Records multiple batch results at once.
   */
  recordBatch(results: BatchResult[], startTime: number): void {
    for (const result of results) {
      if (result.status === "success") {
        this.recordRewrite(result.rewrite, Date.now() - startTime);
      } else {
        this.recordError(result.code);
      }
    }
  }

  /**
   * Returns the total number of rewrites recorded.
   */
  get totalRewrites(): number {
    return this.events.length;
  }

  /**
   * Returns the total number of errors recorded.
   */
  get totalErrors(): number {
    return this.errors.length;
  }

  /**
   * Returns the error rate as a percentage (0-100).
   */
  get errorRate(): number {
    const total = this.totalRewrites + this.totalErrors;
    return total > 0 ? Math.round((this.totalErrors / total) * 100) : 0;
  }

  /**
   * Returns the average rewrite duration in milliseconds.
   */
  get averageDurationMs(): number {
    if (this.events.length === 0) return 0;
    const total = this.events.reduce((sum, e) => sum + e.durationMs, 0);
    return Math.round(total / this.events.length);
  }

  /**
   * Returns the average word reduction per rewrite.
   * Positive means the rewrite is shorter on average.
   */
  get averageWordReduction(): number {
    if (this.events.length === 0) return 0;
    const total = this.events.reduce((sum, e) => sum + e.wordDelta, 0);
    return Math.round(total / this.events.length);
  }

  /**
   * Returns the most frequently used tone.
   */
  get mostUsedTone(): string {
    const counts = this.toneUsageCounts();
    let maxTone = "";
    let maxCount = 0;
    for (const [tone, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxTone = tone;
        maxCount = count;
      }
    }
    return maxTone || "none";
  }

  /**
   * Returns a map of tone to usage count.
   */
  toneUsageCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const event of this.events) {
      counts[event.tone] = (counts[event.tone] || 0) + 1;
    }
    return counts;
  }

  /**
   * Returns per-tone statistics.
   */
  getToneStats(): ToneStats[] {
    const byTone = new Map<string, RewriteEvent[]>();

    for (const event of this.events) {
      const list = byTone.get(event.tone) || [];
      list.push(event);
      byTone.set(event.tone, list);
    }

    const stats: ToneStats[] = [];
    for (const [tone, events] of byTone) {
      const total = events.length;
      const totalOriginal = events.reduce((s, e) => s + e.originalWordCount, 0);
      const totalRewritten = events.reduce((s, e) => s + e.rewrittenWordCount, 0);
      const truncated = events.filter((e) => e.truncated).length;
      const changed = events.filter((e) => e.changed).length;

      stats.push({
        tone,
        totalRewrites: total,
        totalWordsOriginal: totalOriginal,
        totalWordsRewritten: totalRewritten,
        averageReduction: total > 0 ? Math.round((totalOriginal - totalRewritten) / total) : 0,
        averageKeyPoints:
          total > 0 ? Math.round(events.reduce((s, e) => s + e.keyPointCount, 0) / total) : 0,
        truncationRate: total > 0 ? Math.round((truncated / total) * 100) : 0,
        changeRate: total > 0 ? Math.round((changed / total) * 100) : 0,
      });
    }

    return stats.sort((a, b) => b.totalRewrites - a.totalRewrites);
  }

  /**
   * Returns an hourly breakdown of rewrite activity.
   */
  getHourlyBreakdown(): Record<string, number> {
    const hours: Record<string, number> = {};
    for (const event of this.events) {
      const date = new Date(event.timestamp);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:00`;
      hours[key] = (hours[key] || 0) + 1;
    }
    return hours;
  }

  /**
   * Returns the most frequently preserved key points.
   */
  getTopKeyPoints(limit: number = 10): Array<{ point: string; count: number }> {
    const sorted = Array.from(this.keyPointFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([point, count]) => ({ point, count }));
    return sorted;
  }

  /**
   * Returns performance metrics grouped by tone.
   */
  getPerformanceByTone(): Record<string, { avgDurationMs: number; count: number }> {
    const byTone: Record<string, { total: number; count: number }> = {};

    for (const event of this.events) {
      if (!byTone[event.tone]) {
        byTone[event.tone] = { total: 0, count: 0 };
      }
      byTone[event.tone].total += event.durationMs;
      byTone[event.tone].count += 1;
    }

    const result: Record<string, { avgDurationMs: number; count: number }> = {};
    for (const [tone, data] of Object.entries(byTone)) {
      result[tone] = {
        avgDurationMs: Math.round(data.total / data.count),
        count: data.count,
      };
    }

    return result;
  }

  /**
   * Generates a full analytics report.
   */
  generateReport(): AnalyticsReport {
    return {
      totalRewrites: this.totalRewrites,
      totalErrors: this.totalErrors,
      errorRate: this.errorRate,
      averageDurationMs: this.averageDurationMs,
      averageWordReduction: this.averageWordReduction,
      mostUsedTone: this.mostUsedTone,
      toneStats: this.getToneStats(),
      hourlyBreakdown: this.getHourlyBreakdown(),
      topKeyPoints: this.keyPointFrequency,
      performanceByTone: this.getPerformanceByTone(),
    };
  }

  /**
   * Returns a concise usage summary.
   */
  getUsageSummary(): UsageSummary {
    const tones = this.toneUsageCounts();
    const uniqueTones = Object.keys(tones).length;
    const totalOriginal = this.events.reduce((s, e) => s + e.originalWordCount, 0);
    const totalRewritten = this.events.reduce((s, e) => s + e.rewrittenWordCount, 0);
    const totalSaved = totalOriginal - totalRewritten;

    const hours = this.getHourlyBreakdown();
    let maxHour = "";
    let maxCount = 0;
    for (const [hour, count] of Object.entries(hours)) {
      if (count > maxCount) {
        maxHour = hour;
        maxCount = count;
      }
    }

    return {
      totalRewrites: this.totalRewrites,
      uniqueTonesUsed: uniqueTones,
      totalWordsProcessed: totalOriginal,
      totalWordsSaved: Math.max(0, totalSaved),
      averageConfidence:
        this.events.length > 0
          ? Math.round((this.events.filter((e) => e.changed).length / this.events.length) * 100)
          : 0,
      mostProductiveHour: maxHour ? parseInt(maxHour.split(" ")[1].split(":")[0], 10) : 0,
      preferredTone: this.mostUsedTone,
    };
  }

  /**
   * Resets all collected analytics data.
   */
  reset(): void {
    this.events = [];
    this.errors = [];
    this.keyPointFrequency = new Map();
    this.startTime = Date.now();
  }

  /**
   * Returns the uptime of this analytics instance in milliseconds.
   */
  get uptimeMs(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Exports all analytics data as a JSON-serializable object.
   */
  export(): {
    events: RewriteEvent[];
    errors: Array<{ code: string; timestamp: number }>;
    report: AnalyticsReport;
    summary: UsageSummary;
  } {
    return {
      events: this.events,
      errors: this.errors,
      report: this.generateReport(),
      summary: this.getUsageSummary(),
    };
  }
}

/**
 * Creates a new analytics instance.
 */
export function createAnalytics(): RewriteAnalytics {
  return new RewriteAnalytics();
}

/**
 * Compares two analytics reports and returns the differences.
 */
export function compareReports(
  before: AnalyticsReport,
  after: AnalyticsReport,
): Record<string, string> {
  const diffs: Record<string, string> = {};

  const rewriteDiff = after.totalRewrites - before.totalRewrites;
  diffs.rewrites = `${rewriteDiff >= 0 ? "+" : ""}${rewriteDiff}`;

  const errorDiff = after.totalErrors - before.totalErrors;
  diffs.errors = `${errorDiff >= 0 ? "+" : ""}${errorDiff}`;

  const rateDiff = after.errorRate - before.errorRate;
  diffs.errorRate = `${rateDiff >= 0 ? "+" : ""}${rateDiff}%`;

  const durDiff = after.averageDurationMs - before.averageDurationMs;
  diffs.avgDuration = `${durDiff >= 0 ? "+" : ""}${durDiff}ms`;

  const redDiff = after.averageWordReduction - before.averageWordReduction;
  diffs.avgReduction = `${redDiff >= 0 ? "+" : ""}${redDiff} words`;

  return diffs;
}

/**
 * Returns the most common error codes across multiple sessions.
 */
export function aggregateErrors(
  sessions: Array<{ errors: Array<{ code: string }> }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const session of sessions) {
    for (const error of session.errors) {
      counts[error.code] = (counts[error.code] || 0) + 1;
    }
  }
  return counts;
}

/**
 * Computes the average word count across all rewrites in a report.
 */
export function averageWordCount(report: AnalyticsReport): number {
  if (report.toneStats.length === 0) return 0;
  const total = report.toneStats.reduce(
    (s, t) => s + t.totalWordsOriginal + t.totalWordsRewritten,
    0,
  );
  const count = report.toneStats.reduce((s, t) => s + t.totalRewrites * 2, 0);
  return count > 0 ? Math.round(total / count) : 0;
}

/**
 * Returns the tone with the highest change rate.
 */
export function mostChangedTone(report: AnalyticsReport): string {
  let maxTone = "";
  let maxRate = 0;
  for (const stat of report.toneStats) {
    if (stat.changeRate > maxRate) {
      maxRate = stat.changeRate;
      maxTone = stat.tone;
    }
  }
  return maxTone || "none";
}

/**
 * Returns the tone with the highest truncation rate.
 */
export function mostTruncatedTone(report: AnalyticsReport): string {
  let maxTone = "";
  let maxRate = 0;
  for (const stat of report.toneStats) {
    if (stat.truncationRate > maxRate) {
      maxRate = stat.truncationRate;
      maxTone = stat.tone;
    }
  }
  return maxTone || "none";
}
