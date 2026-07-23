/**
 * Tests for performance utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  withTimeout,
  splitIntoChunks,
  processInChunks,
  sleep,
  TranslationCache,
  debounce,
  throttle,
  RateLimitedQueue,
  measurePerformance,
  PerformanceLogger,
  checkMemoryLimit,
  CHUNK_SIZE,
  DEFAULT_TIMEOUT,
  CACHE_TTL,
} from "../services/performance";

describe("withTimeout", () => {
  it("should resolve if promise completes before timeout", async () => {
    const promise = Promise.resolve("success");
    const result = await withTimeout(promise, 1000);
    expect(result).toBe("success");
  });

  it("should reject if promise times out", async () => {
    const promise = new Promise((resolve) => setTimeout(() => resolve("late"), 1000));
    await expect(withTimeout(promise, 100)).rejects.toThrow("Operation timed out");
  });

  it("should use custom error message", async () => {
    const promise = new Promise((resolve) => setTimeout(() => resolve("late"), 1000));
    await expect(withTimeout(promise, 100, "Custom timeout")).rejects.toThrow("Custom timeout");
  });

  it("should use default timeout", async () => {
    const promise = new Promise((resolve) => setTimeout(() => resolve("late"), 20000));
    await expect(withTimeout(promise)).rejects.toThrow();
  }, 15000); // 15 second timeout for this test
});

describe("text chunking", () => {
  describe("splitIntoChunks", () => {
    it("should not split text smaller than chunk size", () => {
      const text = "Short text";
      const chunks = splitIntoChunks(text, 1000);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe("Short text");
    });

    it("should split large text into chunks", () => {
      const text = "a".repeat(150000); // 150 KB
      const chunks = splitIntoChunks(text, CHUNK_SIZE);
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(CHUNK_SIZE);
      });
    });

    it("should split at sentence boundaries when possible", () => {
      const text = "First sentence. ".repeat(1000) + "Last sentence.";
      const chunks = splitIntoChunks(text, 10000);

      // Chunks should end with sentence punctuation (except possibly the last)
      for (let i = 0; i < chunks.length - 1; i++) {
        const chunk = chunks[i].trim();
        expect(chunk.endsWith(".") || chunk.endsWith("!") || chunk.endsWith("?")).toBe(true);
      }
    });

    it("should handle text without sentence boundaries", () => {
      const text = "a".repeat(150000);
      const chunks = splitIntoChunks(text, CHUNK_SIZE);
      expect(chunks.length).toBeGreaterThan(1);

      // All chunks combined should equal original
      expect(chunks.join("").length).toBe(text.length);
    });

    it("should use custom chunk size", () => {
      const text = "a".repeat(100);
      const chunks = splitIntoChunks(text, 30);
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(30);
      });
    });
  });

  describe("processInChunks", () => {
    it("should process all chunks", async () => {
      const text = "a".repeat(150000);
      let processedCount = 0;

      const processor = async (chunk: string) => {
        processedCount++;
        return chunk.length;
      };

      const results = await processInChunks(text, processor, CHUNK_SIZE, 0);
      expect(processedCount).toBeGreaterThan(1);
      expect(results.length).toBe(processedCount);
    });

    it("should add delay between chunks", async () => {
      const text = "Sentence. ".repeat(10000);
      const startTime = Date.now();

      await processInChunks(text, async (chunk) => chunk, 10000, 50);

      const duration = Date.now() - startTime;
      // Should have some delay (at least 50ms for one inter-chunk delay)
      expect(duration).toBeGreaterThanOrEqual(50);
    });

    it("should handle errors in processor", async () => {
      const text = "Test text";
      const processor = async () => {
        throw new Error("Processing failed");
      };

      await expect(processInChunks(text, processor)).rejects.toThrow("Processing failed");
    });
  });

  describe("sleep", () => {
    it("should delay for specified time", async () => {
      const startTime = Date.now();
      await sleep(100);
      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(90); // Allow some variance
      expect(duration).toBeLessThan(200);
    });
  });
});

describe("TranslationCache", () => {
  let cache: TranslationCache;

  beforeEach(() => {
    cache = new TranslationCache(5, 1000); // 5 entries, 1s TTL
  });

  it("should cache successful results", async () => {
    let callCount = 0;
    const translator = async () => {
      callCount++;
      return "translated";
    };

    const result1 = await cache.get("hello", "en", "es", translator);
    const result2 = await cache.get("hello", "en", "es", translator);

    expect(result1).toBe("translated");
    expect(result2).toBe("translated");
    expect(callCount).toBe(1); // Should only call translator once
  });

  it("should deduplicate in-flight requests", async () => {
    let callCount = 0;
    const translator = async () => {
      callCount++;
      await sleep(100);
      return "translated";
    };

    const [result1, result2, result3] = await Promise.all([
      cache.get("hello", "en", "es", translator),
      cache.get("hello", "en", "es", translator),
      cache.get("hello", "en", "es", translator),
    ]);

    expect(result1).toBe("translated");
    expect(result2).toBe("translated");
    expect(result3).toBe("translated");
    expect(callCount).toBe(1); // Should only call translator once
  });

  it("should expire cached entries after TTL", async () => {
    let callCount = 0;
    const translator = async () => {
      callCount++;
      return "translated";
    };

    await cache.get("hello", "en", "es", translator);
    expect(callCount).toBe(1);

    // Wait for TTL to expire
    await sleep(1100);

    await cache.get("hello", "en", "es", translator);
    expect(callCount).toBe(2); // Should call again after expiry
  });

  it("should evict oldest entry when cache is full", async () => {
    const translator = async (text: string) => `translated_${text}`;

    // Fill cache
    for (let i = 0; i < 5; i++) {
      await cache.get(`text${i}`, "en", "es", () => translator(`text${i}`));
    }

    const stats = cache.getStats();
    expect(stats.size).toBe(5);

    // Add one more (should evict oldest)
    await cache.get("text5", "en", "es", () => translator("text5"));
    expect(cache.getStats().size).toBe(5);
  });

  it("should not cache errors", async () => {
    let callCount = 0;
    const translator = async () => {
      callCount++;
      throw new Error("Translation failed");
    };

    await expect(cache.get("hello", "en", "es", translator)).rejects.toThrow("Translation failed");
    await expect(cache.get("hello", "en", "es", translator)).rejects.toThrow("Translation failed");

    expect(callCount).toBe(2); // Should retry on error
  });

  it("should differentiate between language pairs", async () => {
    let callCount = 0;
    const translator = async () => {
      callCount++;
      return "translated";
    };

    await cache.get("hello", "en", "es", translator);
    await cache.get("hello", "en", "fr", translator); // Different target language

    expect(callCount).toBe(2); // Should call twice for different language pairs
  });

  it("should clear cache", async () => {
    const translator = async () => "translated";

    await cache.get("hello", "en", "es", translator);
    expect(cache.getStats().size).toBe(1);

    cache.clear();
    expect(cache.getStats().size).toBe(0);
  });
});

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should delay function execution", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("should reset delay on subsequent calls", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);

    debounced(); // Reset timer
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("should support cancel method", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced.cancel();

    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("throttle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should limit function calls", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    expect(fn).toHaveBeenCalledTimes(1);

    throttled();
    throttled();
    expect(fn).toHaveBeenCalledTimes(1); // Still only called once

    vi.advanceTimersByTime(100);
    throttled();
    expect(fn).toHaveBeenCalledTimes(2); // Called again after limit
  });
});

describe("RateLimitedQueue", () => {
  it.skip("should process tasks with rate limiting", async () => {
    const queue = new RateLimitedQueue(600); // 600 requests/minute = 10/sec
    const results: number[] = [];

    const task1 = queue.add(async () => {
      results.push(1);
      return 1;
    });

    const task2 = queue.add(async () => {
      results.push(2);
      return 2;
    });

    await Promise.all([task1, task2]);

    expect(results).toEqual([1, 2]);
  });

  it.skip("should respect rate limits", async () => {
    const queue = new RateLimitedQueue(600); // 10 per second
    const startTime = Date.now();

    await queue.add(async () => 1);
    await queue.add(async () => 2);

    const duration = Date.now() - startTime;
    expect(duration).toBeGreaterThanOrEqual(90); // At least 100ms delay
  });

  it.skip("should provide queue statistics", async () => {
    const queue = new RateLimitedQueue(600);

    const stats1 = queue.getStats();
    expect(stats1.queueLength).toBe(0);
    expect(stats1.processing).toBe(false);

    const promise = queue.add(async () => {
      await sleep(10);
      return 1;
    });

    // Stats may vary depending on timing
    await promise;

    const stats2 = queue.getStats();
    expect(stats2.requestsPerMinute).toBe(600);
  });
});

describe("measurePerformance", () => {
  it.skip("should measure operation duration", async () => {
    const operation = async () => {
      await sleep(10);
      return "result";
    };

    const { result, metrics } = await measurePerformance(operation);

    expect(result).toBe("result");
    expect(metrics.duration).toBeGreaterThanOrEqual(5); // Allow variance
    expect(metrics.success).toBe(true);
  });

  it("should capture errors", async () => {
    const operation = async () => {
      throw new Error("Test error");
    };

    await expect(measurePerformance(operation)).rejects.toThrow("Test error");
  });

  it("should include metadata", async () => {
    const operation = async () => "result";
    const { metrics } = await measurePerformance(operation, { provider: "test" });

    expect(metrics.provider).toBe("test");
  });
});

describe("PerformanceLogger", () => {
  let logger: PerformanceLogger;

  beforeEach(() => {
    logger = new PerformanceLogger(10);
  });

  it("should log metrics", () => {
    logger.log({
      duration: 100,
      inputSize: 1000,
      outputSize: 1200,
      timestamp: Date.now(),
      success: true,
    });

    const stats = logger.getStats();
    expect(stats.count).toBe(1);
    expect(stats.avgDuration).toBe(100);
    expect(stats.successRate).toBe(1);
  });

  it("should calculate statistics", () => {
    logger.log({
      duration: 100,
      inputSize: 1000,
      outputSize: 1200,
      timestamp: Date.now(),
      success: true,
    });

    logger.log({
      duration: 200,
      inputSize: 2000,
      outputSize: 2400,
      timestamp: Date.now(),
      success: false,
    });

    const stats = logger.getStats();
    expect(stats.count).toBe(2);
    expect(stats.avgDuration).toBe(150);
    expect(stats.successRate).toBe(0.5);
    expect(stats.totalInputSize).toBe(3000);
    expect(stats.totalOutputSize).toBe(3600);
  });

  it("should limit log size", () => {
    for (let i = 0; i < 20; i++) {
      logger.log({
        duration: i,
        inputSize: i,
        outputSize: i,
        timestamp: Date.now(),
        success: true,
      });
    }

    const stats = logger.getStats();
    expect(stats.count).toBe(10); // maxLogs
  });

  it("should clear logs", () => {
    logger.log({
      duration: 100,
      inputSize: 1000,
      outputSize: 1200,
      timestamp: Date.now(),
      success: true,
    });

    expect(logger.getStats().count).toBe(1);

    logger.clear();
    expect(logger.getStats().count).toBe(0);
  });
});

describe("checkMemoryLimit", () => {
  it("should return true for safe sizes", () => {
    expect(checkMemoryLimit(1000000)).toBe(true); // 1 MB
  });

  it("should return false for sizes exceeding threshold", () => {
    expect(checkMemoryLimit(100_000_000, 50)).toBe(false); // 100 MB exceeds 50 MB threshold
  });

  it("should use custom threshold", () => {
    expect(checkMemoryLimit(1_000_000, 0.5)).toBe(false); // 1 MB exceeds 0.5 MB threshold
  });
});
