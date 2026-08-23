/**
 * Mailbox Sync Engine (BETA-034).
 *
 * Implements resilient incremental mailbox synchronization:
 * - Initial snapshot sync and delta sync with durable per-user/per-device cursors
 * - Strict deduplication and timestamp-ordered descriptor reconciliation
 * - Jittered exponential backoff for transient network and server errors
 * - Visibility-aware and connectivity-aware polling lifecycle
 * - Clean request cancellation via AbortController
 * - Automatic recovery from expired cursors (HTTP 410 cursor_expired) via bounded full resync
 */

import { sharedTypedApi as api } from "@/lib/api";
import type {
  MailboxCounts,
  MailboxDescriptor,
  MailboxSyncQuery,
  MailboxSyncResponse,
} from "@/lib/api";
import {
  MAILBOX_DELTA_INTERVAL_MS,
  MAILBOX_PAGE_SIZE,
  MAILBOX_RENDER_CAP,
  MAILBOX_SYNC_CHANNEL,
  capMailboxWindow,
  clearSyncCheckpoint,
  getDeviceId,
  mergeMailboxDescriptors,
  readSyncCheckpoint,
  writeSyncCheckpoint,
  type MailboxBroadcast,
  type SyncCheckpoint,
} from "./live-mailbox";

export interface SyncEngineOptions {
  actor: string;
  deviceId?: string;
  deltaIntervalMs?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  jitterRatio?: number;
  maxRenderCap?: number;
  pageSize?: number;
  onSync?: (response: MailboxSyncResponse) => void;
  onError?: (error: unknown) => void;
  onCursorExpired?: () => void;
}

export interface SyncEngineState {
  status: "idle" | "syncing" | "paused" | "stopped";
  lastSyncAt: string | null;
  checkpoint: SyncCheckpoint | null;
  items: MailboxDescriptor[];
  counts: MailboxCounts | null;
  retryAttempt: number;
  isOnline: boolean;
  isVisible: boolean;
}

export class MailboxSyncEngine {
  private readonly actor: string;
  private readonly deviceId: string;
  private readonly deltaIntervalMs: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly jitterRatio: number;
  private readonly maxRenderCap: number;
  private readonly pageSize: number;
  private readonly tabId: string;

  private onSyncCallback?: (response: MailboxSyncResponse) => void;
  private onErrorCallback?: (error: unknown) => void;
  private onCursorExpiredCallback?: () => void;

  private status: "idle" | "syncing" | "paused" | "stopped" = "idle";
  private retryAttempt = 0;
  private items: MailboxDescriptor[] = [];
  private counts: MailboxCounts | null = null;
  private lastSyncAt: string | null = null;
  private currentAbortController: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private broadcastChannel: BroadcastChannel | null = null;

  private isOnline = true;
  private isVisible = true;

  constructor(options: SyncEngineOptions) {
    this.actor = options.actor;
    this.deviceId = options.deviceId ?? getDeviceId();
    this.deltaIntervalMs = options.deltaIntervalMs ?? MAILBOX_DELTA_INTERVAL_MS;
    this.baseBackoffMs = options.baseBackoffMs ?? 1_000;
    this.maxBackoffMs = options.maxBackoffMs ?? 30_000;
    this.jitterRatio = options.jitterRatio ?? 0.2;
    this.maxRenderCap = options.maxRenderCap ?? MAILBOX_RENDER_CAP;
    this.pageSize = options.pageSize ?? MAILBOX_PAGE_SIZE;
    this.tabId = `tab_${Math.random().toString(36).slice(2, 10)}`;

    this.onSyncCallback = options.onSync;
    this.onErrorCallback = options.onError;
    this.onCursorExpiredCallback = options.onCursorExpired;

    if (typeof window !== "undefined") {
      this.isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      this.isVisible =
        typeof document !== "undefined" ? document.visibilityState === "visible" : true;
      this.initBroadcastChannel();
    }
  }

  getActor(): string {
    return this.actor;
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  getState(): SyncEngineState {
    return {
      status: this.status,
      lastSyncAt: this.lastSyncAt,
      checkpoint: readSyncCheckpoint(this.actor, this.deviceId),
      items: [...this.items],
      counts: this.counts ? { ...this.counts } : null,
      retryAttempt: this.retryAttempt,
      isOnline: this.isOnline,
      isVisible: this.isVisible,
    };
  }

  setOnline(online: boolean): void {
    const prev = this.isOnline;
    this.isOnline = online;
    if (!prev && online) {
      this.retryAttempt = 0;
      void this.triggerSync();
    } else if (!online) {
      this.abortCurrentRequest();
    }
  }

  setVisible(visible: boolean): void {
    const prev = this.isVisible;
    this.isVisible = visible;
    if (!prev && visible && this.isOnline) {
      void this.triggerSync();
    }
  }

  /**
   * Execute an initial full snapshot sync (or paged initial sync).
   */
  async initialSync(
    query: Omit<MailboxSyncQuery, "sinceCursor"> = {},
    signal?: AbortSignal,
  ): Promise<MailboxSyncResponse> {
    const response = await api.mailbox.sync(
      {
        ...query,
        limit: query.limit ?? this.pageSize,
      },
      signal,
    );

    this.applySyncResponse(response, true);
    return response;
  }

  /**
   * Execute an incremental delta sync from a durable checkpoint cursor.
   */
  async deltaSync(sinceCursor: string, signal?: AbortSignal): Promise<MailboxSyncResponse> {
    const response = await api.mailbox.sync(
      {
        sinceCursor,
        limit: 100,
      },
      signal,
    );

    this.applySyncResponse(response, false);
    return response;
  }

  /**
   * Primary sync driver: checks for existing checkpoint cursor.
   * If present, performs delta sync; if absent, performs initial sync.
   * Recovers from expired cursor (HTTP 410) via bounded full resync.
   */
  async sync(signal?: AbortSignal): Promise<MailboxSyncResponse> {
    const checkpoint = readSyncCheckpoint(this.actor, this.deviceId);
    const sinceCursor = checkpoint?.cursor;

    try {
      if (sinceCursor) {
        return await this.deltaSync(sinceCursor, signal);
      }
      return await this.initialSync({}, signal);
    } catch (error: unknown) {
      if (this.isCursorExpiredError(error)) {
        // Cursor expired or invalidated: perform bounded full resync recovery
        this.onCursorExpiredCallback?.();
        clearSyncCheckpoint(this.actor, this.deviceId);
        return await this.initialSync({}, signal);
      }
      throw error;
    }
  }

  /**
   * Triggers a sync cycle with active AbortController and backoff scheduling.
   */
  async triggerSync(): Promise<MailboxSyncResponse | null> {
    if (!this.isOnline || this.status === "stopped") return null;

    this.abortCurrentRequest();
    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;

    this.status = "syncing";
    try {
      const response = await this.sync(signal);
      this.retryAttempt = 0;
      this.status = "idle";
      this.onSyncCallback?.(response);
      this.scheduleNextPoll(this.deltaIntervalMs);
      return response;
    } catch (error: unknown) {
      if (signal.aborted) {
        this.status = "idle";
        return null;
      }
      this.retryAttempt += 1;
      this.status = "idle";
      this.onErrorCallback?.(error);
      const backoff = this.calculateBackoffDelay(this.retryAttempt);
      this.scheduleNextPoll(backoff);
      throw error;
    }
  }

  /**
   * Start polling lifecycle with visibility and connectivity awareness.
   */
  start(): void {
    if (this.status === "stopped") {
      this.status = "idle";
    }
    void this.triggerSync();
  }

  /**
   * Stop polling and cancel pending network requests.
   */
  stop(): void {
    this.status = "stopped";
    this.clearTimer();
    this.abortCurrentRequest();
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {
        // Ignore broadcast close error
      }
      this.broadcastChannel = null;
    }
  }

  /**
   * Broadcast a mutation event to other tabs.
   */
  broadcastMutation(descriptor: MailboxDescriptor): void {
    if (!this.broadcastChannel) return;
    try {
      this.broadcastChannel.postMessage({
        type: "MAILBOX_MUTATION",
        actor: this.actor,
        tabId: this.tabId,
        descriptor,
      } as MailboxBroadcast);
    } catch {
      // Ignore broadcast errors
    }
  }

  /**
   * Calculates exponential backoff with randomized jitter.
   */
  calculateBackoffDelay(attempt: number): number {
    const exp = Math.min(
      this.maxBackoffMs,
      this.baseBackoffMs * Math.pow(2, Math.max(0, attempt - 1)),
    );
    const jitter = exp * this.jitterRatio * (Math.random() * 2 - 1);
    return Math.max(this.baseBackoffMs, Math.floor(exp + jitter));
  }

  private applySyncResponse(response: MailboxSyncResponse, isInitial: boolean): void {
    this.lastSyncAt = new Date().toISOString();
    writeSyncCheckpoint(
      this.actor,
      {
        cursor: response.syncCursor,
        updatedAt: this.lastSyncAt,
        actor: this.actor,
        deviceId: this.deviceId,
        schemaVersion: 1,
      },
      this.deviceId,
    );

    if (isInitial) {
      this.items = capMailboxWindow(response.items, this.maxRenderCap);
    } else {
      this.items = capMailboxWindow(
        mergeMailboxDescriptors(this.items, response.items, response.deletedIds),
        this.maxRenderCap,
      );
    }
    this.counts = response.counts;
  }

  private isCursorExpiredError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const status = (error as { status?: number }).status;
    const code =
      (error as { code?: string; error?: { code?: string } }).code ??
      (error as { error?: { code?: string } }).error?.code;
    return status === 410 || code === "cursor_expired";
  }

  private abortCurrentRequest(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

  private scheduleNextPoll(delayMs: number): void {
    this.clearTimer();
    if (this.status === "stopped") return;

    if (!this.isVisible || !this.isOnline) {
      this.status = "paused";
      return;
    }

    this.timer = setTimeout(() => {
      void this.triggerSync();
    }, delayMs);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private initBroadcastChannel(): void {
    if (typeof BroadcastChannel === "undefined") return;
    try {
      this.broadcastChannel = new BroadcastChannel(MAILBOX_SYNC_CHANNEL);
      this.broadcastChannel.onmessage = (event: MessageEvent<MailboxBroadcast>) => {
        const msg = event.data;
        if (!msg || msg.actor !== this.actor || msg.tabId === this.tabId) return;
        if (msg.type === "MAILBOX_MUTATION") {
          this.items = capMailboxWindow(
            mergeMailboxDescriptors(
              this.items,
              [msg.descriptor],
              msg.descriptor.isTombstone ? [msg.descriptor.messageId] : [],
            ),
            this.maxRenderCap,
          );
        } else if (msg.type === "MAILBOX_INVALIDATE") {
          void this.triggerSync();
        }
      };
    } catch {
      this.broadcastChannel = null;
    }
  }
}
