/**
 * fixtures.ts — Client Thread Timeline (execution contract fixtures)
 *
 * Deterministic local fixtures used by the contract tests and as documentation
 * of the contract shape. Two clients, two threads, unsorted on purpose.
 */

import type { TimelineMessage } from "./types";

/** A mixed set of messages across two clients and two threads (unsorted). */
export const TIMELINE_FIXTURES: TimelineMessage[] = [
  {
    id: "m-3",
    clientId: "client-acme",
    threadId: "thread-onboarding",
    timestamp: "2026-06-01T14:00:00.000Z",
    author: "Acme CS",
    subject: "Welcome to Acme",
    direction: "outbound",
  },
  {
    id: "m-1",
    clientId: "client-acme",
    threadId: "thread-onboarding",
    timestamp: "2026-06-01T09:00:00.000Z",
    author: "Acme User",
    subject: "Getting started question",
    direction: "inbound",
  },
  {
    id: "m-2",
    clientId: "client-acme",
    threadId: "thread-billing",
    timestamp: "2026-06-03T11:30:00.000Z",
    author: "Acme User",
    subject: "Invoice discrepancy",
    direction: "inbound",
  },
  {
    id: "m-4",
    clientId: "client-globex",
    threadId: "thread-support",
    timestamp: "2026-06-02T10:00:00.000Z",
    author: "Globex User",
    subject: "API outage",
    direction: "inbound",
  },
];

/** Messages for client-acme only (subset of TIMELINE_FIXTURES). */
export const ACME_MESSAGES: TimelineMessage[] = TIMELINE_FIXTURES.filter(
  (m) => m.clientId === "client-acme",
);

/** A client with no messages at all (edge case). */
export const EMPTY_MESSAGES: TimelineMessage[] = [];
