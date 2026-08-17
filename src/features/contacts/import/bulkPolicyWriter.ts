import type {
  BulkWriteProgress,
  BulkWriteStatus,
  PolicyWriteJob,
  ImportedContactRow,
} from "./types";

const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const STORAGE_KEY = "stealth-bulk-write-state";

/**
 * Abstract policy writer that can be backed by API calls.
 * In production, swap the implementation to hit your policy API endpoints.
 */
export type PolicyApi = {
  setSenderRule(owner: string, sender: string, rule: "allow" | "block"): Promise<void>;
  removeSenderRule(owner: string, sender: string): Promise<void>;
};

/**
 * Memory-backed policy API for demo/development.
 * Stores rules in a Map and simulates network latency.
 */
export function createMemoryPolicyApi(): PolicyApi & { dump(): Record<string, "allow" | "block"> } {
  const rules = new Map<string, "allow" | "block">();
  return {
    async setSenderRule(owner: string, sender: string, rule: "allow" | "block") {
      await new Promise((r) => setTimeout(r, 15));
      rules.set(`${owner}:${sender}`, rule);
    },
    async removeSenderRule(owner: string, sender: string) {
      await new Promise((r) => setTimeout(r, 10));
      rules.delete(`${owner}:${sender}`);
    },
    dump() {
      return Object.fromEntries(rules);
    },
  };
}

/**
 * Build write jobs from imported contacts.
 * Maps trust levels to policy actions:
 *   "allow" → setSenderRule(owner, sender, "allow")
 *   "block" → setSenderRule(owner, sender, "block")
 *   "default" → skip (no write)
 */
export function buildWriteJobs(
  rows: ImportedContactRow[],
  owner: string,
  fallbackTrust: "allow" | "block" | "default",
): PolicyWriteJob[] {
  return rows
    .filter((r) => !r.error)
    .map((row): PolicyWriteJob | null => {
      const effectiveTrust = row.trust === "default" ? fallbackTrust : row.trust;
      if (effectiveTrust === "default") return null;

      return {
        id: crypto.randomUUID?.() ?? `${owner}:${row.address}:${Date.now()}`,
        owner,
        sender: row.address.trim(),
        action: effectiveTrust === "allow" ? "allow" : "block",
        status: "pending" as const,
        error: null,
        retries: 0,
      };
    })
    .filter((j): j is PolicyWriteJob => j !== null);
}

/**
 * Run the next batch of pending write jobs.
 * Returns updated progress.
 */
export async function runBatch(
  progress: BulkWriteProgress,
  api: PolicyApi,
  owner: string,
): Promise<BulkWriteProgress> {
  const pending = progress.jobs.filter((j) => j.status === "pending");
  if (pending.length === 0) {
    return { ...progress, status: "completed", completedAt: new Date().toISOString() };
  }

  const batch = pending.slice(0, BATCH_SIZE);
  const updatedJobs = [...progress.jobs];

  for (const job of batch) {
    const idx = updatedJobs.findIndex((j) => j.id === job.id);
    if (idx < 0) continue;

    updatedJobs[idx] = { ...updatedJobs[idx], status: "running" };

    try {
      if (job.action === "allow" || job.action === "block") {
        await api.setSenderRule(owner, job.sender, job.action);
      } else {
        await api.removeSenderRule(owner, job.sender);
      }
      updatedJobs[idx] = { ...updatedJobs[idx], status: "success" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (job.retries < MAX_RETRIES) {
        updatedJobs[idx] = {
          ...updatedJobs[idx],
          status: "pending",
          retries: job.retries + 1,
          error: message,
        };
      } else {
        updatedJobs[idx] = {
          ...updatedJobs[idx],
          status: "failed",
          error: message,
          retries: job.retries,
        };
      }
    }
  }

  const succeeded = updatedJobs.filter((j) => j.status === "success").length;
  const failed = updatedJobs.filter((j) => j.status === "failed").length;
  const batchIndex = progress.currentBatch + 1;
  const remaining = updatedJobs.filter((j) => j.status === "pending").length;
  const totalBatches = Math.ceil(updatedJobs.length / BATCH_SIZE);
  const completed = remaining === 0;

  const errorList = updatedJobs
    .filter((j) => j.status === "failed" && j.error)
    .map((j) => ({ sender: j.sender, error: j.error! }));

  return {
    total: updatedJobs.length,
    succeeded,
    failed,
    skipped: updatedJobs.length - succeeded - failed,
    currentBatch: batchIndex,
    totalBatches,
    jobs: updatedJobs,
    errors: errorList,
    resumeToken: completed ? null : `batch-${batchIndex}`,
    status: completed ? "completed" : "running",
    startedAt: progress.startedAt,
    completedAt: completed ? new Date().toISOString() : null,
  };
}

/**
 * Run all batches to completion, pausing-friendly.
 * Call with status="paused" to resume from where you left off.
 */
export async function runAllBatches(
  progress: BulkWriteProgress,
  api: PolicyApi,
  owner: string,
  onProgress?: (p: BulkWriteProgress) => void,
): Promise<BulkWriteProgress> {
  let current = { ...progress, status: "running" as BulkWriteStatus };

  while (current.status === "running") {
    current = await runBatch(current, api, owner);
    onProgress?.(current);
  }

  persistProgress(current);
  return current;
}

/**
 * Pause a running bulk write.
 * Returns updated progress that can be serialised and resumed later.
 */
export function pauseWrite(progress: BulkWriteProgress): BulkWriteProgress {
  const paused: BulkWriteProgress = {
    ...progress,
    status: "paused",
  };
  persistProgress(paused);
  return paused;
}

/**
 * Resume a paused bulk write from stored state.
 */
export function resumeWrite(progress: BulkWriteProgress): BulkWriteProgress {
  return { ...progress, status: "running" };
}

/**
 * Persist progress to localStorage for resume across page reloads.
 */
export function persistProgress(progress: BulkWriteProgress): void {
  try {
    const serialisable = {
      ...progress,
      jobs: progress.jobs.map((j) => ({ ...j })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialisable));
  } catch {
    // storage full or unavailable
  }
}

/**
 * Load persisted bulk write progress.
 */
export function loadProgress(): BulkWriteProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BulkWriteProgress;
  } catch {
    return null;
  }
}

/**
 * Clear persisted progress after completion or cancellation.
 */
export function clearProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Create an initial BulkWriteProgress from write jobs.
 */
export function createProgress(jobs: PolicyWriteJob[]): BulkWriteProgress {
  return {
    total: jobs.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    currentBatch: 0,
    totalBatches: Math.ceil(jobs.length / BATCH_SIZE),
    status: "idle",
    jobs,
    errors: [],
    resumeToken: null,
    startedAt: null,
    completedAt: null,
  };
}

export { BATCH_SIZE, MAX_RETRIES, STORAGE_KEY };
