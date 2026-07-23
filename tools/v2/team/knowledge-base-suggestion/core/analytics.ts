/**
 * analytics.ts — Knowledge Base Suggestion (analytics module)
 *
 * Collects and aggregates suggestion analytics events.
 * Tracks suggestion requests, selections, cache performance, and errors.
 * No imports from the main app.
 */

import type { AnalyticsEvent, AnalyticsSummary } from "../types";
import { AnalyticsEventType } from "../types";

/**
 * Simple analytics collector for suggestion events.
 *
 * Features:
 *   - Records suggestion request events
 *   - Records selection events
 *   - Tracks cache hit/miss statistics
 *   - Aggregates top terms and articles
 *   - Computes selection rate, average latency, cache hit rate
 */
export class AnalyticsCollector {
  private events: AnalyticsEvent[] = [];
  private maxEvents: number;

  constructor(maxEvents: number = 10000) {
    this.maxEvents = maxEvents;
  }

  /**
   * Record a new analytics event.
   * Automatically prunes oldest events if exceeding maxEvents.
   */
  recordEvent(event: AnalyticsEvent): void {
    this.events.push(event);

    // Prune oldest events if we exceed the limit
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  /**
   * Record that a suggestion was requested.
   */
  recordRequest(
    query: string,
    articleIds: string[],
    latencyMs: number,
    fromCache: boolean,
    userId?: string,
    sessionId?: string,
  ): void {
    this.recordEvent({
      id: this.generateId(),
      type: AnalyticsEventType.SuggestionRequested,
      query,
      articleIds,
      selected: false,
      latencyMs,
      fromCache,
      timestamp: Date.now(),
      userId,
      sessionId,
    });
  }

  /**
   * Record that a suggestion was displayed to the user.
   */
  recordDisplay(
    query: string,
    articleIds: string[],
    latencyMs: number,
    userId?: string,
    sessionId?: string,
  ): void {
    this.recordEvent({
      id: this.generateId(),
      type: AnalyticsEventType.SuggestionDisplayed,
      query,
      articleIds,
      selected: false,
      latencyMs,
      fromCache: false,
      timestamp: Date.now(),
      userId,
      sessionId,
    });
  }

  /**
   * Record that a suggestion was selected by the user.
   */
  recordSelection(
    query: string,
    articleIds: string[],
    selectedArticleId: string,
    latencyMs: number,
    userId?: string,
    sessionId?: string,
  ): void {
    this.recordEvent({
      id: this.generateId(),
      type: AnalyticsEventType.SuggestionSelected,
      query,
      articleIds,
      selected: true,
      selectedArticleId,
      latencyMs,
      fromCache: false,
      timestamp: Date.now(),
      userId,
      sessionId,
    });
  }

  /**
   * Record that a suggestion was dismissed by the user.
   */
  recordDismissal(
    query: string,
    articleIds: string[],
    latencyMs: number,
    userId?: string,
    sessionId?: string,
  ): void {
    this.recordEvent({
      id: this.generateId(),
      type: AnalyticsEventType.SuggestionDismissed,
      query,
      articleIds,
      selected: false,
      latencyMs,
      fromCache: false,
      timestamp: Date.now(),
      userId,
      sessionId,
    });
  }

  /**
   * Record an error event.
   */
  recordError(
    query: string,
    errorMessage: string,
    latencyMs: number,
    userId?: string,
    sessionId?: string,
  ): void {
    this.recordEvent({
      id: this.generateId(),
      type: AnalyticsEventType.Error,
      query,
      articleIds: [],
      selected: false,
      latencyMs,
      fromCache: false,
      timestamp: Date.now(),
      userId,
      sessionId,
    });
  }

  /**
   * Generate a unique event ID.
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `evt-${timestamp}-${random}`;
  }

  /**
   * Get the total number of events recorded.
   */
  get totalEvents(): number {
    return this.events.length;
  }

  /**
   * Count events by type.
   */
  countByType(type: AnalyticsEventType): number {
    return this.events.filter((e) => e.type === type).length;
  }

  /**
   * Extract unique terms from a collection of queries.
   */
  private extractTerms(queries: string[]): Map<string, number> {
    const termCounts = new Map<string, number>();
    for (const query of queries) {
      const terms = query
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .filter((t) => t.length > 0);
      for (const term of terms) {
        termCounts.set(term, (termCounts.get(term) ?? 0) + 1);
      }
    }
    return termCounts;
  }

  /**
   * Get the top N terms by frequency.
   */
  private topTerms(n: number): Array<{ term: string; count: number }> {
    const queries = this.events
      .filter((e) => e.type !== AnalyticsEventType.Error)
      .map((e) => e.query)
      .filter((q) => q.length > 0);

    const termCounts = this.extractTerms(queries);
    return Array.from(termCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([term, count]) => ({ term, count }));
  }

  /**
   * Get the top N suggested articles.
   */
  private topSuggestedArticles(n: number): Array<{ articleId: string; count: number }> {
    const counts = new Map<string, number>();
    for (const event of this.events) {
      for (const articleId of event.articleIds) {
        counts.set(articleId, (counts.get(articleId) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([articleId, count]) => ({ articleId, count }));
  }

  /**
   * Get the top N selected articles.
   */
  private topSelectedArticles(n: number): Array<{ articleId: string; count: number }> {
    const counts = new Map<string, number>();
    for (const event of this.events) {
      if (event.selected && event.selectedArticleId) {
        counts.set(event.selectedArticleId, (counts.get(event.selectedArticleId) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([articleId, count]) => ({ articleId, count }));
  }

  /**
   * Get aggregated summary statistics.
   */
  getSummary(): AnalyticsSummary {
    const requestEvents = this.events.filter(
      (e) => e.type === AnalyticsEventType.SuggestionRequested,
    );
    const selectionEvents = this.events.filter(
      (e) => e.type === AnalyticsEventType.SuggestionSelected,
    );
    const errorEvents = this.events.filter((e) => e.type === AnalyticsEventType.Error);
    const cacheHitEvents = this.events.filter((e) => e.type === AnalyticsEventType.CacheHit);
    const cacheMissEvents = this.events.filter((e) => e.type === AnalyticsEventType.CacheMiss);

    const totalRequests = requestEvents.length;
    const totalSelections = selectionEvents.length;

    // Requests with results: suggestion-requested events with non-empty articleIds
    const requestsWithResults = requestEvents.filter((e) => e.articleIds.length > 0).length;
    const requestsWithNoResults = totalRequests - requestsWithResults;

    // Selection rate
    const selectionRate = totalRequests > 0 ? totalSelections / totalRequests : 0;

    // Average latency from request events
    const totalLatency = requestEvents.reduce((sum, e) => sum + e.latencyMs, 0);
    const averageLatencyMs = totalRequests > 0 ? totalLatency / totalRequests : 0;

    // Cache hit rate
    const totalCacheEvents = cacheHitEvents.length + cacheMissEvents.length;
    const cacheHitRate =
      totalCacheEvents > 0
        ? cacheHitEvents.length / totalCacheEvents
        : this.computeCacheHitRateFromEvents();

    // Time period
    const timestamps = this.events.map((e) => e.timestamp);
    const periodStart = timestamps.length > 0 ? Math.min(...timestamps) : 0;
    const periodEnd = timestamps.length > 0 ? Math.max(...timestamps) : 0;

    return {
      totalRequests,
      requestsWithResults,
      requestsWithNoResults,
      totalSelections,
      selectionRate,
      averageLatencyMs,
      cacheHitRate,
      topTerms: this.topTerms(10),
      topArticles: this.topSuggestedArticles(10),
      topSelectedArticles: this.topSelectedArticles(10),
      errorCount: errorEvents.length,
      periodStart,
      periodEnd,
    };
  }

  /**
   * Compute cache hit rate from suggestion-requested events that report fromCache.
   */
  private computeCacheHitRateFromEvents(): number {
    const requestEvents = this.events.filter(
      (e) => e.type === AnalyticsEventType.SuggestionRequested,
    );
    if (requestEvents.length === 0) return 0;
    const cacheHits = requestEvents.filter((e) => e.fromCache).length;
    return cacheHits / requestEvents.length;
  }

  /**
   * Get all events of a specific type.
   */
  getEventsByType(type: AnalyticsEventType): AnalyticsEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  /**
   * Get all events for a specific query.
   */
  getEventsByQuery(query: string): AnalyticsEvent[] {
    return this.events.filter((e) => e.query === query);
  }

  /**
   * Get events within a time range.
   */
  getEventsInRange(startTimestamp: number, endTimestamp: number): AnalyticsEvent[] {
    return this.events.filter((e) => e.timestamp >= startTimestamp && e.timestamp <= endTimestamp);
  }

  /**
   * Clear all events.
   */
  clear(): void {
    this.events = [];
  }
}
