/**
 * Client mailbox sync engine (Issue #1941 BETA-034).
 *
 * Deduplicates events, backs off on transient failures, pauses while the
 * document is hidden, and honors AbortSignal. Checkpoints are persisted per
 * actor and device so reconnects resume without duplicating messages.
 */
import { applySyncEvents, bufferOutOfOrder } from "./apply-events";
import {
  clearCheckpoint,
  loadCheckpoint,
  loadOrCreateDeviceId,
  saveCheckpoint,
  type CheckpointStore,
} from "./sync-checkpoint";
import { fetchMailboxSync } from "./sync-client";
import {
  MailboxSyncError,
  type MailboxSyncCheckpoint,
  type MailboxSyncEvent,
  type SyncedMailboxMessage,
} from "./types";

const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 60_000;
const DEFAULT_POLL_INTERVAL_MS = 5_000;

export interface VisibilityController {
  hidden: boolean;
  subscribe(listener: () => void): () => void;
}

export interface MailboxSyncEngineOptions {
  actor: string;
  store: CheckpointStore;
  fetchSync?: typeof fetchMailboxSync;
  pollIntervalMs?: number;
  visibility?: VisibilityController;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => string;
  createDeviceId?: () => string;
  onChange?: (messages: Map<string, SyncedMailboxMessage>) => void;
  tabLock?: TabLock;
}

export interface TabLock {
  acquire(): Promise<boolean>;
  release(): void;
}

export class MemoryTabLock implements TabLock {
  private held = false;

  async acquire(): Promise<boolean> {
    if (this.held) return false;
    this.held = true;
    return true;
  }

  release(): void {
    this.held = false;
  }
}

export function alwaysVisible(): VisibilityController {
  return { hidden: false, subscribe: () => () => {} };
}

export function createDocumentVisibility(
  target: {
    hidden: boolean;
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
  } | null = typeof document === "undefined" ? null : document,
): VisibilityController {
  if (!target) return alwaysVisible();
  return {
    get hidden() {
      return Boolean(target.hidden);
    },
    subscribe(listener) {
      target.addEventListener("visibilitychange", listener);
      return () => target.removeEventListener("visibilitychange", listener);
    },
  };
}

function abortError(): Error {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export class MailboxSyncEngine {
  readonly actor: string;
  readonly deviceId: string;
  private readonly store: CheckpointStore;
  private readonly fetchSync: typeof fetchMailboxSync;
  private readonly pollIntervalMs: number;
  private readonly visibility: VisibilityController;
  private readonly sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  private readonly now: () => string;
  private readonly onChange?: (messages: Map<string, SyncedMailboxMessage>) => void;
  private readonly tabLock: TabLock;
  private abort: AbortController | null = null;
  private loop: Promise<void> | null = null;
  private backoffMs = MIN_BACKOFF_MS;
  private pending: MailboxSyncEvent[] = [];
  messages = new Map<string, SyncedMailboxMessage>();
  appliedSeq = 0;
  cursor: string | null = null;

  constructor(options: MailboxSyncEngineOptions) {
    this.actor = options.actor;
    this.store = options.store;
    this.deviceId = loadOrCreateDeviceId(options.store, options.createDeviceId);
    this.fetchSync = options.fetchSync ?? fetchMailboxSync;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.visibility = options.visibility ?? alwaysVisible();
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? (() => new Date().toISOString());
    this.onChange = options.onChange;
    this.tabLock = options.tabLock ?? new MemoryTabLock();
    this.restoreCheckpoint();
  }

  get running(): boolean {
    return this.abort !== null;
  }

  start(): void {
    if (this.abort) return;
    this.abort = new AbortController();
    this.loop = this.run(this.abort.signal);
  }

  async stop(): Promise<void> {
    this.abort?.abort();
    this.abort = null;
    if (this.loop) {
      await this.loop.catch(() => undefined);
      this.loop = null;
    }
  }

  async syncOnce(signal?: AbortSignal): Promise<void> {
    const acquired = await this.tabLock.acquire();
    if (!acquired) return;
    try {
      await this.pullUntilCaughtUp(signal);
    } finally {
      this.tabLock.release();
    }
  }

  private restoreCheckpoint(): void {
    const checkpoint = loadCheckpoint(this.store, this.actor, this.deviceId);
    if (!checkpoint) return;
    this.cursor = checkpoint.cursor;
    this.appliedSeq = checkpoint.appliedSeq;
  }

  private persist(): void {
    const checkpoint: MailboxSyncCheckpoint = {
      actor: this.actor,
      deviceId: this.deviceId,
      cursor: this.cursor,
      appliedSeq: this.appliedSeq,
      appliedMessageIds: [...this.messages.keys()],
      updatedAt: this.now(),
    };
    saveCheckpoint(this.store, checkpoint);
  }

  private emit(): void {
    this.onChange?.(new Map(this.messages));
  }

  private apply(events: readonly MailboxSyncEvent[]): void {
    this.pending = bufferOutOfOrder(this.pending, events);
    const result = applySyncEvents(this.messages, this.pending, this.appliedSeq);
    this.messages = result.messages;
    this.appliedSeq = result.appliedSeq;
    this.pending = this.pending.filter((event) => event.seq > this.appliedSeq);
    this.emit();
  }

  private async pullUntilCaughtUp(signal?: AbortSignal): Promise<void> {
    let hasMore = true;
    while (hasMore) {
      signal?.throwIfAborted();
      try {
        const result = await this.fetchSync({
          actor: this.actor,
          deviceId: this.deviceId,
          cursor: this.cursor,
          signal,
        });
        this.apply(result.events);
        this.cursor = result.cursor;
        this.persist();
        this.backoffMs = MIN_BACKOFF_MS;
        hasMore = result.hasMore;
      } catch (error) {
        if (error instanceof MailboxSyncError && error.code === "cursor_expired") {
          this.cursor = null;
          this.appliedSeq = 0;
          this.messages = new Map();
          this.pending = [];
          clearCheckpoint(this.store, this.actor, this.deviceId);
          this.emit();
          continue;
        }
        throw error;
      }
    }
  }

  private async run(signal: AbortSignal): Promise<void> {
    const unsubscribe = this.visibility.subscribe(() => {
      if (!this.visibility.hidden && this.abort) {
        void this.syncOnce(signal).catch(() => undefined);
      }
    });

    try {
      while (!signal.aborted) {
        if (this.visibility.hidden) {
          await this.sleep(this.pollIntervalMs, signal).catch(() => undefined);
          continue;
        }
        try {
          await this.syncOnce(signal);
          await this.sleep(this.pollIntervalMs, signal);
        } catch (error) {
          if (signal.aborted) return;
          if (error instanceof MailboxSyncError && !error.retryable) {
            return;
          }
          await this.sleep(this.backoffMs, signal).catch(() => undefined);
          this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
        }
      }
    } finally {
      unsubscribe();
    }
  }
}
