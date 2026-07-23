/**
 * cache.ts — Knowledge Base Suggestion (in-memory cache module)
 *
 * Pure in-memory cache for suggestion results.
 * Supports TTL-based expiration, LRU eviction, and corpus hash invalidation.
 * No imports from the main app.
 */

import type { KbSuggestion, CacheConfig, CacheEntry } from "../types";
import { DEFAULT_CACHE_CONFIG } from "../types";

/**
 * In-memory suggestion cache with TTL and LRU eviction.
 *
 * Features:
 *   - TTL-based expiration per entry
 *   - LRU (Least Recently Used) eviction when max entries exceeded
 *   - Corpus hash invalidation (old cache entries invalidated on corpus change)
 *   - Auto-cleanup of expired entries on configurable interval
 *   - Statistics tracking (hits, misses, size)
 */
export class SuggestionCache {
  private cache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = [];
  private config: CacheConfig;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private hits: number = 0;
  private misses: number = 0;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      maxEntries: config?.maxEntries ?? DEFAULT_CACHE_CONFIG.maxEntries,
      defaultTtlMs: config?.defaultTtlMs ?? DEFAULT_CACHE_CONFIG.defaultTtlMs,
      enableCleanup: config?.enableCleanup ?? DEFAULT_CACHE_CONFIG.enableCleanup,
      cleanupIntervalMs: config?.cleanupIntervalMs ?? DEFAULT_CACHE_CONFIG.cleanupIntervalMs,
    };

    if (this.config.enableCleanup) {
      this.startCleanup();
    }
  }

  /**
   * Build a composite cache key from query hash and corpus hash.
   */
  private buildKey(queryHash: string, corpusHash: string): string {
    return `${corpusHash}:${queryHash}`;
  }

  /**
   * Update the access order for LRU tracking.
   */
  private touch(key: string): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx > -1) {
      this.accessOrder.splice(idx, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Evict the least recently used entry.
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;
    const lruKey = this.accessOrder.shift()!;
    this.cache.delete(lruKey);
  }

  /**
   * Check if an entry has expired.
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Remove all expired entries.
   */
  private removeExpired(): number {
    let removed = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        const idx = this.accessOrder.indexOf(key);
        if (idx > -1) this.accessOrder.splice(idx, 1);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Start periodic cleanup of expired entries.
   */
  private startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.removeExpired();
    }, this.config.cleanupIntervalMs);

    // Allow the process to exit even if the timer is still running
    if (this.cleanupTimer && typeof this.cleanupTimer === "object") {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop periodic cleanup.
   */
  private stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Get a cached suggestion result.
   *
   * @param queryHash - Hash of the query string
   * @param corpusHash - Hash of the corpus
   * @returns The cached suggestions, or null if not found or expired
   */
  get(queryHash: string, corpusHash: string): { suggestions: KbSuggestion[] } | null {
    if (!queryHash || !corpusHash) {
      this.misses++;
      return null;
    }

    const key = this.buildKey(queryHash, corpusHash);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check expiration
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      const idx = this.accessOrder.indexOf(key);
      if (idx > -1) this.accessOrder.splice(idx, 1);
      this.misses++;
      return null;
    }

    // Update hit count and access order
    entry.hitCount++;
    this.touch(key);
    this.hits++;

    return { suggestions: entry.suggestions };
  }

  /**
   * Store a suggestion result in the cache.
   *
   * @param queryHash - Hash of the query string
   * @param corpusHash - Hash of the corpus
   * @param suggestions - The suggestion results to cache
   * @param corpusSize - Size of the corpus at cache time
   * @param ttlMs - Optional custom TTL (defaults to config defaultTtlMs)
   */
  set(
    queryHash: string,
    corpusHash: string,
    suggestions: KbSuggestion[],
    corpusSize: number,
    ttlMs?: number,
  ): void {
    if (!queryHash || !corpusHash || !suggestions) return;

    const key = this.buildKey(queryHash, corpusHash);

    // Evict if at capacity
    if (this.cache.size >= this.config.maxEntries) {
      this.evictLRU();
    }

    const entry: CacheEntry = {
      suggestions,
      timestamp: Date.now(),
      ttl: ttlMs ?? this.config.defaultTtlMs,
      hitCount: 0,
      query: queryHash,
      corpusHash,
      corpusSize,
    };

    this.cache.set(key, entry);
    this.touch(key);
  }

  /**
   * Invalidate a specific cache entry.
   */
  invalidate(queryHash: string, corpusHash: string): boolean {
    const key = this.buildKey(queryHash, corpusHash);
    const existed = this.cache.has(key);
    if (existed) {
      this.cache.delete(key);
      const idx = this.accessOrder.indexOf(key);
      if (idx > -1) this.accessOrder.splice(idx, 1);
    }
    return existed;
  }

  /**
   * Invalidate all cache entries with a matching corpus hash.
   */
  invalidateByCorpus(corpusHash: string): number {
    let removed = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.corpusHash === corpusHash) {
        this.cache.delete(key);
        const idx = this.accessOrder.indexOf(key);
        if (idx > -1) this.accessOrder.splice(idx, 1);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Invalidate all cached entries.
   */
  invalidateAll(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get the number of cached entries.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache hit count.
   */
  get hitCount(): number {
    return this.hits;
  }

  /**
   * Get cache miss count.
   */
  get missCount(): number {
    return this.misses;
  }

  /**
   * Get the cache hit rate (0-1).
   */
  get hitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }

  /**
   * Get cache statistics.
   */
  getStats(): {
    size: number;
    maxEntries: number;
    hits: number;
    misses: number;
    hitRate: number;
    expiredCount: number;
  } {
    const expiredCount = this.removeExpired();
    return {
      size: this.cache.size,
      maxEntries: this.config.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hitRate,
      expiredCount,
    };
  }

  /**
   * Dispose the cache, stopping cleanup timers.
   */
  dispose(): void {
    this.stopCleanup();
    this.invalidateAll();
    this.hits = 0;
    this.misses = 0;
  }
}

/**
 * Create a simple cache with no dependencies.
 * Useful for one-off suggestions without persistent caching.
 */
export function createNoOpCache(): { get: () => null; set: () => void; getStats: () => object } {
  return {
    get: () => null,
    set: () => {},
    getStats: () => ({ size: 0, hits: 0, misses: 0, hitRate: 0 }),
  };
}
