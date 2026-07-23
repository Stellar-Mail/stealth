/**
 * Email Translator — Performance Utilities
 *
 * This module provides performance optimization utilities:
 * - Request deduplication and caching
 * - Timeout enforcement
 * - Chunking for large texts
 * - Debouncing and throttling
 * - Memory management
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum chunk size for large text translation (50 KB)
 */
export const CHUNK_SIZE = 50_000;

/**
 * Default timeout for translation requests (10 seconds)
 */
export const DEFAULT_TIMEOUT = 10_000;

/**
 * Default debounce delay for language detection (500ms)
 */
export const DETECTION_DEBOUNCE_DELAY = 500;

/**
 * Maximum number of cached translation results
 */
export const MAX_CACHE_SIZE = 50;

/**
 * Cache TTL (time to live) in milliseconds (5 minutes)
 */
export const CACHE_TTL = 5 * 60 * 1000;

// ============================================================================
// Timeout Enforcement
// ============================================================================

/**
 * Wraps a promise with a timeout
 *
 * @param promise - Promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Error message if timeout occurs
 * @returns Promise that rejects if timeout is reached
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT,
  errorMessage = "Operation timed out",
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Wraps a fetch call with timeout using AbortController
 *
 * @param input - Fetch input
 * @param init - Fetch init options
 * @param timeoutMs - Timeout in milliseconds
 * @returns Fetch response
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// Text Chunking
// ============================================================================

/**
 * Splits large text into chunks at sentence boundaries
 *
 * Attempts to break on sentence boundaries (. ! ?) to preserve context.
 * Falls back to hard breaks if no sentence boundary is found.
 *
 * @param text - Text to split
 * @param maxSize - Maximum chunk size (default 50KB)
 * @returns Array of text chunks
 */
export function splitIntoChunks(text: string, maxSize: number = CHUNK_SIZE): string[] {
  if (text.length <= maxSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxSize, text.length);

    // Try to break on sentence boundary if not at end of text
    if (end < text.length) {
      // Look for sentence endings (. ! ?) followed by space or newline
      const sentenceEndPattern = /[.!?][\s\n]/g;
      let lastSentenceEnd = -1;

      // Search backwards from end position
      const searchText = text.slice(start, end);
      let match: RegExpExecArray | null;

      while ((match = sentenceEndPattern.exec(searchText)) !== null) {
        lastSentenceEnd = match.index + 1; // Include the punctuation
      }

      // If we found a sentence boundary, use it
      if (lastSentenceEnd > maxSize / 2) {
        // Only use if it's past halfway point
        end = start + lastSentenceEnd + 1; // +1 to include the space/newline
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end;
  }

  return chunks;
}

/**
 * Processes large text in chunks with a delay between chunks
 *
 * @param text - Text to process
 * @param processor - Async function to process each chunk
 * @param chunkSize - Maximum chunk size
 * @param delayMs - Delay between chunks (for rate limiting)
 * @returns Concatenated results
 */
export async function processInChunks<T>(
  text: string,
  processor: (chunk: string) => Promise<T>,
  chunkSize: number = CHUNK_SIZE,
  delayMs: number = 100,
): Promise<T[]> {
  const chunks = splitIntoChunks(text, chunkSize);
  const results: T[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const result = await processor(chunks[i]);
    results.push(result);

    // Add delay between chunks (except after last chunk)
    if (i < chunks.length - 1) {
      await sleep(delayMs);
    }
  }

  return results;
}

/**
 * Sleep utility for adding delays
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Request Caching and Deduplication
// ============================================================================

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

/**
 * Translation request cache
 *
 * Provides caching and deduplication for translation requests.
 * - Deduplicates in-flight requests (same params = same promise)
 * - Caches successful results with TTL
 * - Automatically evicts old entries (LRU-style)
 */
export class TranslationCache {
  private cache = new Map<string, CacheEntry<string>>();
  private inFlight = new Map<string, Promise<string>>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = MAX_CACHE_SIZE, ttl: number = CACHE_TTL) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Generates cache key from translation parameters
   */
  private getCacheKey(text: string, from: string, to: string): string {
    // Use first 100 chars of text + language pair as key
    // In production, consider using a hash function for better key distribution
    const textPrefix = text.slice(0, 100);
    return `${from}:${to}:${textPrefix}`;
  }

  /**
   * Gets cached result or executes translator function
   *
   * - Returns cached result if available and not expired
   * - Deduplicates in-flight requests
   * - Caches successful results
   *
   * @param text - Text to translate
   * @param from - Source language
   * @param to - Target language
   * @param translator - Function that performs translation
   * @returns Translated text
   */
  async get(
    text: string,
    from: string,
    to: string,
    translator: () => Promise<string>,
  ): Promise<string> {
    const key = this.getCacheKey(text, from, to);

    // Check cache first
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.value;
    }

    // Check if request is already in-flight
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key)!;
    }

    // Execute new request
    const promise = translator()
      .then((result) => {
        // Cache successful result
        this.set(key, result);
        return result;
      })
      .catch((err) => {
        // Don't cache errors
        throw err;
      })
      .finally(() => {
        // Remove from in-flight
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * Sets a value in the cache
   */
  private set(key: string, value: string): void {
    // Evict oldest entry if cache is full (simple LRU)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Clears the cache
   */
  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  /**
   * Gets cache statistics
   */
  getStats(): { size: number; inFlight: number; maxSize: number } {
    return {
      size: this.cache.size,
      inFlight: this.inFlight.size,
      maxSize: this.maxSize,
    };
  }
}

// ============================================================================
// Debouncing and Throttling
// ============================================================================

/**
 * Debounces a function
 *
 * @param fn - Function to debounce
 * @param delayMs - Delay in milliseconds
 * @returns Debounced function with cancel method
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number,
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null;

  const debounced = function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn.apply(this, args);
      timeoutId = null;
    }, delayMs);
  } as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Throttles a function
 *
 * @param fn - Function to throttle
 * @param limitMs - Minimum time between invocations
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(fn: T, limitMs: number): T {
  let lastCall = 0;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastCall >= limitMs) {
      lastCall = now;
      return fn.apply(this, args);
    }
  } as T;
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Rate-limited queue for translation requests
 *
 * Ensures a maximum number of requests per time window.
 * Useful for respecting provider API rate limits.
 */
export class RateLimitedQueue {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private requestsPerMinute: number;
  private intervalMs: number;

  constructor(requestsPerMinute: number) {
    this.requestsPerMinute = requestsPerMinute;
    this.intervalMs = 60000 / requestsPerMinute; // ms between requests
  }

  /**
   * Adds a task to the queue
   *
   * @param task - Async task to execute
   * @returns Promise that resolves when task completes
   */
  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });

      if (!this.processing) {
        this.process();
      }
    });
  }

  /**
   * Processes queued tasks with rate limiting
   */
  private async process(): Promise<void> {
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      await task();

      // Wait before processing next task (rate limit)
      if (this.queue.length > 0) {
        await sleep(this.intervalMs);
      }
    }

    this.processing = false;
  }

  /**
   * Gets queue statistics
   */
  getStats(): { queueLength: number; processing: boolean; requestsPerMinute: number } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      requestsPerMinute: this.requestsPerMinute,
    };
  }
}

// ============================================================================
// Performance Monitoring
// ============================================================================

export interface PerformanceMetrics {
  duration: number;
  inputSize: number;
  outputSize: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

/**
 * Measures performance of an async operation
 *
 * @param operation - Async operation to measure
 * @param metadata - Additional metadata to include in metrics
 * @returns Result and performance metrics
 */
export async function measurePerformance<T>(
  operation: () => Promise<T>,
  metadata: Record<string, any> = {},
): Promise<{ result: T; metrics: PerformanceMetrics & Record<string, any> }> {
  const startTime = performance.now();
  const startMemory = (performance as any).memory?.usedJSHeapSize;

  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    const endMemory = (performance as any).memory?.usedJSHeapSize;

    const metrics: PerformanceMetrics & Record<string, any> = {
      duration,
      inputSize: 0, // Can be populated by caller
      outputSize: 0, // Can be populated by caller
      timestamp: Date.now(),
      success: true,
      ...metadata,
    };

    if (startMemory !== undefined && endMemory !== undefined) {
      metrics.memoryDelta = endMemory - startMemory;
    }

    return { result, metrics };
  } catch (err) {
    const duration = performance.now() - startTime;

    const metrics: PerformanceMetrics & Record<string, any> = {
      duration,
      inputSize: 0,
      outputSize: 0,
      timestamp: Date.now(),
      success: false,
      error: (err as Error).message,
      ...metadata,
    };

    throw err;
  }
}

/**
 * Simple performance logger (can be extended with analytics integration)
 */
export class PerformanceLogger {
  private logs: PerformanceMetrics[] = [];
  private maxLogs: number;

  constructor(maxLogs: number = 100) {
    this.maxLogs = maxLogs;
  }

  /**
   * Logs performance metrics
   */
  log(metrics: PerformanceMetrics): void {
    this.logs.push(metrics);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // In production, send to analytics service
    if (process.env.NODE_ENV === "development") {
      console.debug("[Performance]", metrics);
    }
  }

  /**
   * Gets performance statistics
   */
  getStats(): {
    count: number;
    avgDuration: number;
    successRate: number;
    totalInputSize: number;
    totalOutputSize: number;
  } {
    if (this.logs.length === 0) {
      return {
        count: 0,
        avgDuration: 0,
        successRate: 0,
        totalInputSize: 0,
        totalOutputSize: 0,
      };
    }

    const totalDuration = this.logs.reduce((sum, log) => sum + log.duration, 0);
    const successCount = this.logs.filter((log) => log.success).length;
    const totalInputSize = this.logs.reduce((sum, log) => sum + log.inputSize, 0);
    const totalOutputSize = this.logs.reduce((sum, log) => sum + log.outputSize, 0);

    return {
      count: this.logs.length,
      avgDuration: totalDuration / this.logs.length,
      successRate: successCount / this.logs.length,
      totalInputSize,
      totalOutputSize,
    };
  }

  /**
   * Clears performance logs
   */
  clear(): void {
    this.logs = [];
  }
}

// ============================================================================
// Memory Management
// ============================================================================

/**
 * Checks if an operation would exceed memory limits
 *
 * @param estimatedSize - Estimated memory usage in bytes
 * @param thresholdMb - Warning threshold in MB
 * @returns True if operation is safe
 */
export function checkMemoryLimit(estimatedSize: number, thresholdMb: number = 50): boolean {
  const thresholdBytes = thresholdMb * 1024 * 1024;

  if (estimatedSize > thresholdBytes) {
    console.warn(
      `Operation may exceed memory limit: ${(estimatedSize / 1024 / 1024).toFixed(2)} MB ` +
        `(threshold: ${thresholdMb} MB)`,
    );
    return false;
  }

  return true;
}

/**
 * Gets current memory usage (if available)
 */
export function getMemoryUsage(): { heapUsed: number; heapTotal: number } | null {
  const memory = (performance as any).memory;

  if (memory) {
    return {
      heapUsed: memory.usedJSHeapSize,
      heapTotal: memory.totalJSHeapSize,
    };
  }

  return null;
}
