import type { BetaControlPersistence, BetaControlSnapshotData } from "./store";
import { MemoryPersistence } from "./store";

/**
 * Shared KV-backed persistence for operator beta controls.
 *
 * BETA-095: every worker falls back to `MemoryPersistence` unless the factory
 * is given a shared adapter, so operator kill-switch / flag / cohort / invite
 * mutations were invisible across workers and lost on restart. This adapter
 * writes the authoritative snapshot to the deployment's KV namespace so changes
 * are durable and propagate to every worker after the bounded cache TTL.
 *
 * When no KV binding is available (local dev, tests, single-process runs) it
 * degrades to the in-memory adapter so the service remains usable.
 */

const SNAPSHOT_KEY = "beta-controls:snapshot";

interface KvLike {
  get(key: string, type?: "text" | "json"): Promise<unknown>;
  put(key: string, value: string, opts?: unknown): Promise<void>;
}

function isKvLike(value: unknown): value is KvLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as KvLike).get === "function" &&
    typeof (value as KvLike).put === "function"
  );
}

/**
 * Selects the appropriate persistence adapter for the current deployment. A
 * KV binding is used when present; otherwise the in-memory adapter is used.
 */
export function createBetaControlPersistence(kvBinding: unknown): BetaControlPersistence {
  if (isKvLike(kvBinding)) {
    return new KvBetaControlPersistence(kvBinding);
  }
  return new MemoryPersistence();
}

class KvBetaControlPersistence implements BetaControlPersistence {
  private kv: KvLike;

  constructor(kv: KvLike) {
    this.kv = kv;
  }

  async load(): Promise<BetaControlSnapshotData | null> {
    const raw = await this.kv.get(SNAPSHOT_KEY, "json");
    if (!raw || typeof raw !== "object") return null;
    return raw as BetaControlSnapshotData;
  }

  async save(snapshot: BetaControlSnapshotData): Promise<void> {
    await this.kv.put(SNAPSHOT_KEY, JSON.stringify(snapshot));
  }
}
