// ---------------------------------------------------------------------------
// BETA-064 (Issue #1971) — delivery and read-receipt controls.
//
// Provides the client-side receipt state management layer:
//  - React Query for server-backed receipt records
//  - Mutation for publishing read receipts with duplicate-action safety
//  - Offline queue persisted to localStorage, replayed on reconnect
//  - Cross-device consistency via BroadcastChannel + delta sync
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ReceiptRecord } from "@/lib/api";
import {
  cacheInvalidations,
  claimOnce,
  classifyAppFailure,
  queryKeys,
  releaseOnce,
  sharedTypedApi as api,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Offline receipt queue (localStorage)
// ---------------------------------------------------------------------------

const RECEIPT_QUEUE_KEY = "stealth.receipts.queue.v1";

export interface QueuedReceiptAction {
  messageId: string;
  action: "read";
  queuedAt: string;
}

function readReceiptQueue(): QueuedReceiptAction[] {
  try {
    const raw = localStorage.getItem(RECEIPT_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeReceiptQueue(queue: QueuedReceiptAction[]): void {
  try {
    localStorage.setItem(RECEIPT_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full or unavailable — fail silently; queue is best-effort.
  }
}

function enqueueReceiptAction(action: QueuedReceiptAction): void {
  const queue = readReceiptQueue();
  if (queue.some((e) => e.messageId === action.messageId && e.action === action.action)) return;
  queue.push(action);
  writeReceiptQueue(queue);
}

function dequeueReceiptAction(messageId: string, action: "read"): QueuedReceiptAction | undefined {
  const queue = readReceiptQueue();
  const idx = queue.findIndex((e) => e.messageId === messageId && e.action === action);
  if (idx === -1) return undefined;
  const [removed] = queue.splice(idx, 1);
  writeReceiptQueue(queue);
  return removed;
}

function clearReceiptQueue(): void {
  try {
    localStorage.removeItem(RECEIPT_QUEUE_KEY);
  } catch {
    // Ignore.
  }
}

// ---------------------------------------------------------------------------
// Cross-device receipt broadcast
// ---------------------------------------------------------------------------

export const RECEIPT_SYNC_CHANNEL = "stealth_receipt_sync";

export interface ReceiptBroadcast {
  type: "RECEIPT_UPDATE";
  actor: string;
  tabId: string;
  messageId: string;
  receipt: ReceiptRecord;
}

// ---------------------------------------------------------------------------
// Dedup guard — in-flight receipt mutations per message
// ---------------------------------------------------------------------------

const inflightReceipts = new Set<string>();

// ---------------------------------------------------------------------------
// Per-message receipt query
// ---------------------------------------------------------------------------

export function useReceiptQuery(messageId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.receipts.byMessage(messageId ?? ""),
    queryFn: ({ signal }) => api.receipts.get(messageId!, signal),
    enabled: Boolean(messageId) && enabled,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mark-read mutation with offline queue, dedup, and broadcast
// ---------------------------------------------------------------------------

export function useMarkReadReceipt(actor: string | null) {
  const queryClient = useQueryClient();
  const tabIdRef = useRef(`receipt_tab_${Math.random().toString(36).slice(2, 10)}`);
  const onlineRef = useRef(true);

  useEffect(() => {
    const check = () => {
      onlineRef.current = typeof navigator === "undefined" || navigator.onLine;
    };
    check();
    window.addEventListener("online", check);
    window.addEventListener("offline", check);
    return () => {
      window.removeEventListener("online", check);
      window.removeEventListener("offline", check);
    };
  }, []);

  const mutateAsync = useCallback(
    async (messageId: string): Promise<ReceiptRecord | null> => {
      const dedupKey = `read:${messageId}`;
      if (!claimOnce(inflightReceipts, dedupKey)) {
        const existing = queryClient.getQueryData<ReceiptRecord>(
          queryKeys.receipts.byMessage(messageId),
        );
        return existing ?? null;
      }

      try {
        if (!onlineRef.current) {
          enqueueReceiptAction({
            messageId,
            action: "read",
            queuedAt: new Date().toISOString(),
          });
          const optimistic: ReceiptRecord = {
            messageId,
            sender: "",
            recipient: actor ?? "",
            deliveredAt: new Date().toISOString(),
            readAt: new Date().toISOString(),
            chainStatus: "pending",
          };
          queryClient.setQueryData(queryKeys.receipts.byMessage(messageId), optimistic);
          return optimistic;
        }

        const receipt = await api.receipts.markRead(messageId);
        queryClient.setQueryData(queryKeys.receipts.byMessage(messageId), receipt);

        if (actor) {
          broadcastReceiptUpdate(actor, tabIdRef.current, messageId, receipt);
        }

        return receipt;
      } catch (caught) {
        const classified = classifyAppFailure(caught, { online: onlineRef.current });
        if (classified.kind === "offline") {
          enqueueReceiptAction({
            messageId,
            action: "read",
            queuedAt: new Date().toISOString(),
          });
          return null;
        }
        throw caught;
      } finally {
        releaseOnce(inflightReceipts, dedupKey);
      }
    },
    [actor, queryClient],
  );

  return { mutateAsync };
}

// ---------------------------------------------------------------------------
// Offline queue replay — call once at app shell level
// ---------------------------------------------------------------------------

export function useReceiptQueueReplay(actor: string | null, online: boolean) {
  const { mutateAsync: markRead } = useMarkReadReceipt(actor);
  const replayedRef = useRef(false);

  useEffect(() => {
    if (!online || !actor) return;
    if (replayedRef.current) return;
    replayedRef.current = true;

    const queue = readReceiptQueue();
    if (queue.length === 0) return;

    void (async () => {
      for (const entry of queue) {
        if (entry.action === "read") {
          dequeueReceiptAction(entry.messageId, "read");
          try {
            await markRead(entry.messageId);
          } catch {
            // Re-enqueue on failure.
            enqueueReceiptAction(entry);
          }
        }
      }
    })();
  }, [actor, online, markRead]);
}

// ---------------------------------------------------------------------------
// Cross-device receipt broadcast listener — call once at app shell level
// ---------------------------------------------------------------------------

export function useReceiptBroadcastListener(actor: string | null) {
  const queryClient = useQueryClient();
  const tabIdRef = useRef(`receipt_tab_${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    if (!actor) return;
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;

    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(RECEIPT_SYNC_CHANNEL);
    } catch {
      return;
    }

    channel.onmessage = (event: MessageEvent<ReceiptBroadcast>) => {
      const message = event.data;
      if (
        !message ||
        message.type !== "RECEIPT_UPDATE" ||
        message.actor !== actor ||
        message.tabId === tabIdRef.current
      )
        return;

      queryClient.setQueryData(queryKeys.receipts.byMessage(message.messageId), message.receipt);
    };

    return () => {
      channel.close();
    };
  }, [actor, queryClient]);
}

// ---------------------------------------------------------------------------
// Broadcast helper
// ---------------------------------------------------------------------------

function broadcastReceiptUpdate(
  actor: string,
  tabId: string,
  messageId: string,
  receipt: ReceiptRecord,
): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel(RECEIPT_SYNC_CHANNEL);
    channel.postMessage({
      type: "RECEIPT_UPDATE",
      actor,
      tabId,
      messageId,
      receipt,
    } satisfies ReceiptBroadcast);
    channel.close();
  } catch {
    // Broadcast failure is non-fatal; polling still reconciles.
  }
}

// ---------------------------------------------------------------------------
// Per-sender-type receipt preference resolution
// ---------------------------------------------------------------------------

export type ReceiptSenderType = "trusted" | "unknown" | "paid" | "organizations";

export function resolveReceiptPreference(
  senderType: ReceiptSenderType,
  preferences: {
    receiptOnDelivery: boolean;
    receipts: Record<ReceiptSenderType, "auto" | "manual" | "never">;
  },
): "auto" | "manual" | "never" {
  if (!preferences.receiptOnDelivery) return "never";
  return preferences.receipts[senderType] ?? "manual";
}

/**
 * Determine the sender type for a given email based on existing trust signals.
 */
export function resolveSenderType(email: {
  senderPolicy?: "allow" | "verify" | "block";
  postageAmount?: string;
  verifiedSender?: boolean;
}): ReceiptSenderType {
  if (email.senderPolicy === "allow") return "trusted";
  if (email.verifiedSender) return "organizations";
  if (email.postageAmount && email.postageAmount !== "0") return "paid";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Per-message receipt override (localStorage)
// ---------------------------------------------------------------------------

const RECEIPT_OVERRIDES_KEY = "stealth.receipts.overrides.v1";

export type ReceiptOverride = "auto" | "manual" | "never";

function readReceiptOverrides(): Record<string, ReceiptOverride> {
  try {
    const raw = localStorage.getItem(RECEIPT_OVERRIDES_KEY);
    if (!raw) return {};
    return JSON.parse(raw) ?? {};
  } catch {
    return {};
  }
}

function writeReceiptOverrides(overrides: Record<string, ReceiptOverride>): void {
  try {
    localStorage.setItem(RECEIPT_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // Ignore.
  }
}

export function getReceiptOverride(messageId: string): ReceiptOverride | null {
  const overrides = readReceiptOverrides();
  return overrides[messageId] ?? null;
}

export function setReceiptOverride(messageId: string, value: ReceiptOverride | null): void {
  const overrides = readReceiptOverrides();
  if (value === null) {
    delete overrides[messageId];
  } else {
    overrides[messageId] = value;
  }
  writeReceiptOverrides(overrides);
}

// ---------------------------------------------------------------------------
// Delivery receipt state tracking
// ---------------------------------------------------------------------------

export type DeliveryReceiptStatus = "none" | "pending" | "delivered" | "failed";

export function useDeliveryReceiptStatus(messageId: string | null, enabled = true) {
  const receiptQuery = useReceiptQuery(messageId, enabled);

  const status: DeliveryReceiptStatus = useMemo(() => {
    if (!messageId) return "none";
    if (receiptQuery.isLoading) return "none";
    if (receiptQuery.isError) return "none";
    if (!receiptQuery.data) return "none";
    if (receiptQuery.data.chainStatus === "failed") return "failed";
    if (receiptQuery.data.chainStatus === "pending") return "pending";
    return "delivered";
  }, [messageId, receiptQuery.data, receiptQuery.isLoading, receiptQuery.isError]);

  return {
    status,
    deliveredAt: receiptQuery.data?.deliveredAt ?? null,
    isPending: status === "pending",
    isFailed: status === "failed",
    isDelivered: status === "delivered",
  };
}

// ---------------------------------------------------------------------------
// Read receipt state tracking
// ---------------------------------------------------------------------------

export type ReadReceiptStatus = "none" | "pending" | "sent" | "failed";

export function useReadReceiptStatus(messageId: string | null, enabled = true) {
  const receiptQuery = useReceiptQuery(messageId, enabled);

  const status: ReadReceiptStatus = useMemo(() => {
    if (!messageId) return "none";
    if (receiptQuery.isLoading) return "none";
    if (receiptQuery.isError) return "none";
    if (!receiptQuery.data) return "none";
    if (receiptQuery.data.readAt) return "sent";
    if (receiptQuery.data.chainStatus === "pending") return "pending";
    return "none";
  }, [messageId, receiptQuery.data, receiptQuery.isLoading, receiptQuery.isError]);

  return {
    status,
    readAt: receiptQuery.data?.readAt ?? null,
    isPending: status === "pending",
    isSent: status === "sent",
  };
}
