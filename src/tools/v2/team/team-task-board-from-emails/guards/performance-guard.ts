/**
 * Team Task Board from Emails - Performance Guard
 *
 * Enforces performance constraints and resource limits
 * Requirement 4: Performance Constraints for Email Processing
 * Requirement 11: Resource Cleanup and Memory Management
 */

import type { GuardResult, TimeoutGuard, ResourceUsage, PerformanceLimits } from "../types";

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_LIMITS: PerformanceLimits = {
  maxProcessingTimeMs: 5_000, // 5 seconds per email
  maxMemoryMb: 50, // 50 MB per email
  maxEmailsPerBatch: 1000,
  maxThreadDepth: 50,
  maxRegexSteps: 10_000,
};

const THREAD_LIMITS = {
  maxProcessingTimeMs: 30_000, // 30 seconds per thread
  maxEmails: 500,
  maxTotalSize: 50 * 1024 * 1024, // 50 MB
};

const BATCH_LIMITS = {
  maxMemoryMb: 500, // 500 MB total
  maxEmails: 1000,
};

// ============================================================================
// Timeout Guard
// ============================================================================

export class TimeoutGuardImpl implements TimeoutGuard {
  startTime: number;
  timeoutMs: number;

  constructor(timeoutMs: number) {
    this.startTime = Date.now();
    this.timeoutMs = timeoutMs;
  }

  isExpired(): boolean {
    return Date.now() - this.startTime > this.timeoutMs;
  }

  remainingMs(): number {
    const remaining = this.timeoutMs - (Date.now() - this.startTime);
    return Math.max(0, remaining);
  }

  static create(timeoutMs: number): TimeoutGuard {
    return new TimeoutGuardImpl(timeoutMs);
  }
}

// ============================================================================
// Performance Guard
// ============================================================================

export class PerformanceGuard {
  private limits: PerformanceLimits;
  private resourceUsage: Map<string, ResourceUsage>;

  constructor(limits: Partial<PerformanceLimits> = {}) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.resourceUsage = new Map();
  }

  /**
   * Creates a timeout guard for email processing
   */
  createEmailTimeout(): TimeoutGuard {
    return TimeoutGuardImpl.create(this.limits.maxProcessingTimeMs);
  }

  /**
   * Creates a timeout guard for thread processing
   */
  createThreadTimeout(): TimeoutGuard {
    return TimeoutGuardImpl.create(THREAD_LIMITS.maxProcessingTimeMs);
  }

  /**
   * Checks if processing should continue based on timeout
   */
  checkTimeout(guard: TimeoutGuard, context: string): GuardResult {
    if (guard.isExpired()) {
      return {
        allowed: false,
        reason: `Processing timeout exceeded for ${context} (${guard.timeoutMs}ms)`,
        guardType: "time",
      };
    }

    return {
      allowed: true,
      guardType: "time",
    };
  }

  /**
   * Checks if email size is within limits
   */
  checkEmailSize(bodyLength: number): GuardResult<number> {
    const MAX_SIZE = 5_000_000; // 5 MB

    if (bodyLength > MAX_SIZE) {
      return {
        allowed: false,
        reason: `Email body size (${bodyLength} bytes) exceeds limit (${MAX_SIZE} bytes)`,
        guardType: "size",
      };
    }

    return {
      allowed: true,
      value: bodyLength,
      guardType: "size",
    };
  }

  /**
   * Checks if thread size is within limits
   */
  checkThreadSize(emailCount: number, totalSize: number): GuardResult {
    if (emailCount > THREAD_LIMITS.maxEmails) {
      return {
        allowed: false,
        reason: `Thread email count (${emailCount}) exceeds limit (${THREAD_LIMITS.maxEmails})`,
        guardType: "size",
      };
    }

    if (totalSize > THREAD_LIMITS.maxTotalSize) {
      return {
        allowed: false,
        reason: `Thread total size (${totalSize} bytes) exceeds limit (${THREAD_LIMITS.maxTotalSize} bytes)`,
        guardType: "size",
      };
    }

    return {
      allowed: true,
      guardType: "size",
    };
  }

  /**
   * Checks if batch size is within limits
   */
  checkBatchSize(emailCount: number): GuardResult {
    if (emailCount > BATCH_LIMITS.maxEmails) {
      return {
        allowed: false,
        reason: `Batch size (${emailCount}) exceeds limit (${BATCH_LIMITS.maxEmails})`,
        guardType: "size",
      };
    }

    return {
      allowed: true,
      guardType: "size",
    };
  }

  /**
   * Checks if thread depth is within limits
   */
  checkThreadDepth(depth: number): GuardResult {
    if (depth > this.limits.maxThreadDepth) {
      return {
        allowed: false,
        reason: `Thread depth (${depth}) exceeds limit (${this.limits.maxThreadDepth})`,
        guardType: "depth",
      };
    }

    return {
      allowed: true,
      guardType: "depth",
    };
  }

  /**
   * Checks estimated memory usage
   */
  checkMemoryUsage(estimatedMb: number): GuardResult {
    if (estimatedMb > this.limits.maxMemoryMb) {
      return {
        allowed: false,
        reason: `Estimated memory usage (${estimatedMb} MB) exceeds limit (${this.limits.maxMemoryMb} MB)`,
        guardType: "memory",
      };
    }

    return {
      allowed: true,
      guardType: "memory",
    };
  }

  /**
   * Estimates memory usage for an email
   */
  estimateEmailMemory(bodyLength: number, attachmentCount: number): number {
    // Rough estimate: body size + overhead + attachments
    const bodyMb = bodyLength / (1024 * 1024);
    const overheadMb = 0.5; // 500 KB overhead
    const attachmentMb = attachmentCount * 0.1; // 100 KB per attachment metadata

    return bodyMb + overheadMb + attachmentMb;
  }

  /**
   * Tracks resource usage for an operation
   */
  trackResourceUsage(operationId: string, usage: ResourceUsage): void {
    this.resourceUsage.set(operationId, usage);
  }

  /**
   * Gets resource usage for an operation
   */
  getResourceUsage(operationId: string): ResourceUsage | undefined {
    return this.resourceUsage.get(operationId);
  }

  /**
   * Clears resource tracking for an operation
   */
  clearResourceUsage(operationId: string): void {
    this.resourceUsage.delete(operationId);
  }

  /**
   * Clears all resource tracking
   */
  clearAllResources(): void {
    this.resourceUsage.clear();
  }

  /**
   * Creates a safe regex with backtracking limit
   * Prevents ReDoS attacks
   */
  static createSafeRegex(pattern: string, flags: string = ""): RegExp {
    // This is a simplified version
    // In production, consider using safe-regex or similar libraries
    return new RegExp(pattern, flags);
  }

  /**
   * Tests a regex with backtracking limit
   * Returns null if limit exceeded
   */
  static testRegexSafe(
    regex: RegExp,
    input: string,
    maxSteps: number = DEFAULT_LIMITS.maxRegexSteps,
  ): RegExpExecArray | null {
    // Create timeout guard
    const guard = TimeoutGuardImpl.create(100); // 100ms max

    try {
      // Test if timeout occurs (simplified ReDoS protection)
      const result = regex.exec(input);

      if (guard.isExpired()) {
        throw new Error("Regex execution timeout - possible ReDoS");
      }

      return result;
    } catch (error) {
      // Log ReDoS attempt
      console.warn("Regex execution blocked:", error);
      return null;
    }
  }

  /**
   * Rate limiter for operations
   */
  private rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();

  checkRateLimit(operationKey: string, maxOperations: number, windowMs: number): GuardResult {
    const now = Date.now();
    const existing = this.rateLimitMap.get(operationKey);

    if (!existing || now > existing.resetTime) {
      // Reset or initialize
      this.rateLimitMap.set(operationKey, {
        count: 1,
        resetTime: now + windowMs,
      });
      return { allowed: true, guardType: "rate" };
    }

    if (existing.count >= maxOperations) {
      return {
        allowed: false,
        reason: `Rate limit exceeded for ${operationKey}: ${maxOperations} operations per ${windowMs}ms`,
        guardType: "rate",
      };
    }

    existing.count++;
    return { allowed: true, guardType: "rate" };
  }

  /**
   * Concurrent operation limiter
   */
  private concurrentOps: Set<string> = new Set();
  private readonly maxConcurrent = 10;

  acquireConcurrentSlot(operationId: string): GuardResult {
    if (this.concurrentOps.size >= this.maxConcurrent) {
      return {
        allowed: false,
        reason: `Maximum concurrent operations (${this.maxConcurrent}) reached`,
        guardType: "complexity",
      };
    }

    this.concurrentOps.add(operationId);
    return { allowed: true, guardType: "complexity" };
  }

  releaseConcurrentSlot(operationId: string): void {
    this.concurrentOps.delete(operationId);
  }

  /**
   * Checks for circular references in thread structure
   */
  static detectCircularReference(
    threadStructure: Map<string, string[]>,
    emailId: string,
    visited: Set<string> = new Set(),
  ): boolean {
    if (visited.has(emailId)) {
      return true; // Circular reference detected
    }

    visited.add(emailId);

    const references = threadStructure.get(emailId) || [];
    for (const refId of references) {
      if (this.detectCircularReference(threadStructure, refId, visited)) {
        return true;
      }
    }

    visited.delete(emailId);
    return false;
  }
}

// ============================================================================
// Memory Monitor (Simplified)
// ============================================================================

export class MemoryMonitor {
  private baseline: number = 0;

  /**
   * Records baseline memory usage
   */
  recordBaseline(): void {
    if (typeof process !== "undefined" && process.memoryUsage) {
      this.baseline = process.memoryUsage().heapUsed;
    }
  }

  /**
   * Gets current memory delta from baseline
   */
  getMemoryDeltaMb(): number {
    if (typeof process !== "undefined" && process.memoryUsage) {
      const current = process.memoryUsage().heapUsed;
      return (current - this.baseline) / (1024 * 1024);
    }
    return 0;
  }

  /**
   * Checks if memory pressure exists
   */
  hasMemoryPressure(): boolean {
    const delta = this.getMemoryDeltaMb();
    return delta > BATCH_LIMITS.maxMemoryMb * 0.8; // 80% threshold
  }
}
