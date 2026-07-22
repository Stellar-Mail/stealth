/**
 * contract.ts — Client Thread Timeline (non-UI execution contract)
 *
 * Backend-facing execution contract for building a per-client, per-thread
 * chronological timeline from raw messages. Presentation-free: no React, no
 * DOM. Operations return a typed WatchlistResult-style outcome with explicit
 * error codes instead of throwing.
 */

import type {
  BuildTimelineInput,
  ClientTimeline,
  GetThreadInput,
  TimelineMessage,
  TimelineOrder,
  TimelineThread,
} from "./types";

/** Explicit, machine-readable error codes for contract operations. */
export enum TimelineErrorCode {
  /** A required field was missing or failed validation. */
  InvalidInput = "INVALID_INPUT",
  /** The referenced client/thread was not found among the inputs. */
  NotFound = "NOT_FOUND",
  /** A message referenced an unknown client/thread. */
  OrphanMessage = "ORPHAN_MESSAGE",
}

/** Discriminated outcome returned by every contract operation. */
export type TimelineResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: TimelineErrorCode; message: string };

/** Operations supported by the timeline contract. */
export type TimelineOperation =
  | { operation: "buildTimeline"; input: BuildTimelineInput; order?: TimelineOrder }
  | { operation: "getThread"; input: GetThreadInput };

/** Outputs produced by the timeline contract, keyed by operation. */
export type TimelineContractOutput =
  | { operation: "buildTimeline"; timeline: ClientTimeline }
  | { operation: "getThread"; thread: TimelineThread };

/** Backend-facing entry point for the client thread timeline. */
export interface TimelineContract {
  execute(input: TimelineOperation): TimelineResult<TimelineContractOutput>;
}

/** Typed success outcome. */
export function ok<T>(value: T): TimelineResult<T> {
  return { ok: true, value };
}

/** Typed error outcome. */
export function fail<T = never>(error: TimelineErrorCode, message: string): TimelineResult<T> {
  return { ok: false, error, message };
}

/**
 * Build a ClientTimeline from raw messages.
 *
 * Groups messages by threadId, orders each thread's messages by timestamp
 * (asc by default, desc if requested), and orders threads by their earliest
 * message. Empty and unsorted inputs are handled without error.
 */
export function buildClientTimeline(
  input: BuildTimelineInput,
  order: TimelineOrder = "asc",
): ClientTimeline {
  const { clientId, messages } = input;
  const owned = messages.filter((m) => m.clientId === clientId);

  const byThread = new Map<string, TimelineMessage[]>();
  for (const m of owned) {
    const list = byThread.get(m.threadId) ?? [];
    list.push(m);
    byThread.set(m.threadId, list);
  }

  const dir = order === "desc" ? -1 : 1;
  const threads: TimelineThread[] = [...byThread.entries()].map(([threadId, msgs]) => ({
    threadId,
    clientId,
    messages: [...msgs].sort((a, b) => dir * (Date.parse(a.timestamp) - Date.parse(b.timestamp))),
  }));

  // Order threads by their earliest message timestamp.
  threads.sort((a, b) => {
    const aEarliest = Date.parse(a.messages[0]?.timestamp ?? "0");
    const bEarliest = Date.parse(b.messages[0]?.timestamp ?? "0");
    return dir * (aEarliest - bEarliest);
  });

  const totalMessages = threads.reduce((sum, t) => sum + t.messages.length, 0);
  return { clientId, threads, totalMessages };
}

/**
 * Extract a single thread for a client.
 *
 * Returns NotFound if the client/thread has no messages in the input.
 */
export function getClientThread(input: GetThreadInput): TimelineThread | null {
  const { clientId, threadId, messages } = input;
  const owned = messages.filter((m) => m.clientId === clientId && m.threadId === threadId);
  if (owned.length === 0) return null;
  const sorted = [...owned].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return { threadId, clientId, messages: sorted };
}
