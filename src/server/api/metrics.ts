/**
 * Bounded dependency metrics for required infrastructure dependencies.
 *
 * Labels are finite and contain no URLs or account identifiers.
 * Dependency identifiers are fixed constants: "kv" | "coordinator".
 *
 * Outcome classifications:
 *   - "success"  - call completed without error
 *   - "timeout"  - call exceeded the latency threshold (AbortError / timeout)
 *   - "failure"  - any other error
 */

export type Dependency = "kv" | "coordinator";
export type Outcome = "success" | "timeout" | "failure";

export interface DependencyMetrics {
  /** Total calls recorded */
  calls: number;
  /** Calls that succeeded */
  successes: number;
  /** Calls classified as timeout */
  timeouts: number;
  /** Calls classified as failure (non-timeout error) */
  failures: number;
  /** Sum of latency samples in milliseconds */
  totalLatencyMs: number;
  /** Number of latency samples */
  latencySamples: number;
}

function emptyMetrics(): DependencyMetrics {
  return {
    calls: 0,
    successes: 0,
    timeouts: 0,
    failures: 0,
    totalLatencyMs: 0,
    latencySamples: 0,
  };
}

// In-process store - suitable for Cloudflare Workers isolate lifetime.
const store = new Map<string, DependencyMetrics>([
  ["kv", emptyMetrics()],
  ["coordinator", emptyMetrics()],
]);

function get(dep: Dependency): DependencyMetrics {
  return store.get(dep) as DependencyMetrics;
}

/**
 * Record a single availability observation for a dependency.
 * This is the low-level primitive; prefer recordDependencyCall for
 * combined availability + latency tracking.
 */
export function incrementCounter(metric: string, labels: Record<string, string>): void {
  const dep = labels["dependency"] as Dependency | undefined;
  if (!dep || !store.has(dep)) return;

  const m = get(dep);
  m.calls++;

  if (metric === "dependency_call_success") {
    m.successes++;
  } else if (metric === "dependency_call_timeout") {
    m.timeouts++;
  } else if (metric === "dependency_call_failure") {
    m.failures++;
  }
}

/**
 * Record a latency sample for a dependency in milliseconds.
 */
export function recordLatency(dep: Dependency, latencyMs: number): void {
  const m = get(dep);
  m.totalLatencyMs += latencyMs;
  m.latencySamples++;
}

/**
 * Convenience wrapper: runs fn, classifies the outcome, and emits
 * both an availability counter and a latency sample.
 *
 * Timeout detection: AbortError or errors whose message contains
 * "timeout" (case-insensitive) are classified as "timeout".
 */
export async function recordDependencyCall<T>(dep: Dependency, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const latencyMs = Date.now() - start;
    recordLatency(dep, latencyMs);
    incrementCounter("dependency_call_success", { dependency: dep });
    return result;
  } catch (err) {
    const latencyMs = Date.now() - start;
    recordLatency(dep, latencyMs);
    const outcome = classifyError(err);
    incrementCounter(`dependency_call_${outcome}`, { dependency: dep });
    throw err;
  }
}

function classifyError(err: unknown): "timeout" | "failure" {
  if (err instanceof Error) {
    if (err.name === "AbortError" || /timeout/i.test(err.message)) {
      return "timeout";
    }
  }
  return "failure";
}

/**
 * Returns a snapshot of the current metrics for a dependency.
 * Useful for health-check endpoints and tests.
 */
export function getMetrics(dep: Dependency): Readonly<DependencyMetrics> {
  return { ...get(dep) };
}

/**
 * Returns availability ratio [0, 1] for a dependency.
 * Returns 1 when no calls have been recorded yet.
 */
export function getAvailability(dep: Dependency): number {
  const m = get(dep);
  if (m.calls === 0) return 1;
  return m.successes / m.calls;
}

/**
 * Returns mean latency in milliseconds, or 0 when no samples exist.
 */
export function getMeanLatencyMs(dep: Dependency): number {
  const m = get(dep);
  if (m.latencySamples === 0) return 0;
  return m.totalLatencyMs / m.latencySamples;
}

/** Reset all metrics (intended for use in tests only). */
export function _resetMetrics(): void {
  store.set("kv", emptyMetrics());
  store.set("coordinator", emptyMetrics());
}
