import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LoadTestResult } from "./harness";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export type PerformanceBudget = {
  maxFailureRate: number;
  maxP90Ms: number;
  maxP99Ms: number;
  minRateLimitHits: number;
};

export type BudgetOptions = {
  minSuccesses?: number;
  enforceFailureRate?: boolean;
  requireRateLimit?: boolean;
  allowedStatuses?: number[];
  budget?: PerformanceBudget;
};

export function loadPerformanceBudget(
  path = join(ROOT, "scripts/ci/performance-budget.json"),
): PerformanceBudget {
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  return {
    maxFailureRate: Number(process.env.LOAD_BUDGET_MAX_FAILURE_RATE ?? raw.maxFailureRate),
    maxP90Ms: Number(process.env.LOAD_BUDGET_MAX_P90_MS ?? raw.maxP90Ms),
    maxP99Ms: Number(process.env.LOAD_BUDGET_MAX_P99_MS ?? raw.maxP99Ms),
    minRateLimitHits: Number(process.env.LOAD_BUDGET_MIN_RATE_LIMIT_HITS ?? raw.minRateLimitHits),
  };
}

export function percentile(sortedLatencies: number[], ratio: number) {
  if (!sortedLatencies.length) return 0;
  return sortedLatencies[Math.floor(sortedLatencies.length * ratio)] ?? 0;
}

export function evaluateBudget(
  name: string,
  result: LoadTestResult,
  options: BudgetOptions = {},
): { ok: true } {
  const budget = options.budget ?? loadPerformanceBudget();
  const networkErrors = result.statusCodes[0] ?? 0;
  const failureRate = result.totalRequests === 0 ? 1 : result.failures / result.totalRequests;
  const p90 = percentile(result.latenciesMs, 0.9);
  const p99 = percentile(result.latenciesMs, 0.99);
  const minSuccesses = options.minSuccesses ?? 1;
  const enforceFailureRate = options.enforceFailureRate ?? true;
  const allowedStatuses = options.allowedStatuses ?? [];

  if (result.totalRequests === 0 || result.failures === result.totalRequests) {
    if (minSuccesses > 0 || enforceFailureRate) {
      throw new Error(`${name}: all requests failing`);
    }
  }
  if (networkErrors > 0) {
    throw new Error(`${name}: ${networkErrors} network/fetch errors (status 0)`);
  }
  if (result.successes < minSuccesses) {
    throw new Error(
      `${name}: expected at least ${minSuccesses} successful requests, got ${result.successes}`,
    );
  }
  if (enforceFailureRate && failureRate > budget.maxFailureRate) {
    throw new Error(
      `${name}: failure rate ${failureRate.toFixed(3)} exceeded budget ${budget.maxFailureRate.toFixed(3)}`,
    );
  }
  if (p90 > budget.maxP90Ms) {
    throw new Error(`${name}: p90 ${p90.toFixed(2)}ms exceeded budget ${budget.maxP90Ms}ms`);
  }
  if (p99 > budget.maxP99Ms) {
    throw new Error(`${name}: p99 ${p99.toFixed(2)}ms exceeded budget ${budget.maxP99Ms}ms`);
  }
  if (options.requireRateLimit && (result.statusCodes[429] ?? 0) < budget.minRateLimitHits) {
    throw new Error(
      `${name}: expected at least ${budget.minRateLimitHits} 429 responses, got ${result.statusCodes[429] ?? 0}`,
    );
  }
  if (allowedStatuses.length > 0) {
    const unexpected = Object.keys(result.statusCodes)
      .map(Number)
      .filter((status) => status !== 0 && !allowedStatuses.includes(status));
    if (unexpected.length > 0) {
      throw new Error(
        `${name}: unexpected status codes ${unexpected.join(", ")}; expected ${allowedStatuses.join(", ")}`,
      );
    }
  }
  return { ok: true };
}
