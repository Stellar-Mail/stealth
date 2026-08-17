/**
 * types.ts — Client Thread Timeline (non-UI execution contract)
 *
 * Domain types for grouping mail messages into a per-client, per-thread
 * chronological timeline. No imports from the main app; presentation-free.
 */

/** A single mail message in a thread. */
export interface TimelineMessage {
  id: string;
  /** Client this message belongs to. */
  clientId: string;
  /** Thread this message belongs to (groups related messages). */
  threadId: string;
  /** ISO-8601 timestamp, e.g. "2026-06-01T09:30:00.000Z". */
  timestamp: string;
  /** Author/participant display label. */
  author: string;
  /** Short subject or summary. */
  subject: string;
  /** Direction of the message relative to the team. */
  direction: "inbound" | "outbound";
}

/** A thread is a group of messages sharing a threadId, ordered by time. */
export interface TimelineThread {
  threadId: string;
  clientId: string;
  messages: TimelineMessage[];
}

/** A client timeline is the set of threads for one client, ordered by time. */
export interface ClientTimeline {
  clientId: string;
  threads: TimelineThread[];
  /** Total message count across all threads. */
  totalMessages: number;
}

/** Input for building a client timeline. */
export interface BuildTimelineInput {
  clientId: string;
  messages: TimelineMessage[];
}

/** Input for querying a single thread. */
export interface GetThreadInput {
  clientId: string;
  threadId: string;
  messages: TimelineMessage[];
}

/** Supported sort orders for a timeline. */
export type TimelineOrder = "asc" | "desc";
