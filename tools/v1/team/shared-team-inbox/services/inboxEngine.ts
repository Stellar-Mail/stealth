/**
 * Shared Team Inbox — core feature engine (#445).
 *
 * Folder-local, framework-free triage engine for a collaborative team mailbox.
 * No network, no secrets, no production data. State is held by a swappable
 * in-memory storage adapter (reference implementation only).
 *
 * Implements per the specs:
 *  - Ingest messages addressed to the shared identity.
 *  - Claim/assign with visible ownership state.
 *  - Internal annotation threads (team-visible, sender-invisible).
 *  - Reply using the shared identity (recorded, never auto-sent externally).
 *  - Status machine: unassigned -> claimed -> in-progress ->
 *    awaiting-reply -> resolved.
 */

import type { Annotation, TeamMessage, TeamReply, TriageRecord, TriageStatus } from "../types";

/** Allowed triage transitions (any state may release back to unassigned). */
const TRIAGE_TRANSITIONS: Record<TriageStatus, TriageStatus[]> = {
  unassigned: ["claimed"],
  claimed: ["in-progress", "unassigned"],
  "in-progress": ["awaiting-reply", "claimed", "resolved"],
  "awaiting-reply": ["in-progress", "resolved", "claimed"],
  resolved: ["claimed"], // re-open
};

/** Error raised when a requested status transition is not permitted. */
export class TriageTransitionError extends Error {
  constructor(
    public readonly from: TriageStatus,
    public readonly to: TriageStatus,
  ) {
    super(`Illegal triage transition: ${from} -> ${to}`);
    this.name = "TriageTransitionError";
  }
}

export function isAllowedTransition(from: TriageStatus, to: TriageStatus): boolean {
  return TRIAGE_TRANSITIONS[from].includes(to);
}

let _seq = 0;
function genId(prefix: string): string {
  _seq += 1;
  return `${prefix}-${String(_seq).padStart(4, "0")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export interface TeamInbox {
  ingest: (message: TeamMessage) => TriageRecord;
  claim: (messageId: string, assignee: string) => TriageRecord;
  release: (messageId: string) => TriageRecord;
  setStatus: (messageId: string, status: TriageStatus) => TriageRecord;
  annotate: (messageId: string, author: string, body: string) => Annotation;
  reply: (messageId: string, author: string, body: string) => TeamReply;
  get: (messageId: string) => TriageRecord | undefined;
  list: (status?: TriageStatus) => TriageRecord[];
}

/**
 * Create an in-memory team inbox. `seed` allows deterministic tests.
 */
export function createTeamInbox(seed: TriageRecord[] = []): TeamInbox {
  const store: Record<string, TriageRecord> = {};
  for (const rec of seed) store[rec.message.id] = rec;

  function requireRecord(messageId: string): TriageRecord {
    const rec = store[messageId];
    if (!rec) throw new Error(`Message not found: ${messageId}`);
    return rec;
  }

  function save(rec: TriageRecord): TriageRecord {
    const updated: TriageRecord = { ...rec, updatedAt: nowIso() };
    store[rec.message.id] = updated;
    return updated;
  }

  function allRecords(): TriageRecord[] {
    return Object.keys(store).map((k) => store[k]);
  }

  return {
    ingest(message) {
      if (store[message.id]) {
        throw new Error(`Duplicate message id: ${message.id}`);
      }
      const rec: TriageRecord = {
        message,
        status: "unassigned",
        assignee: null,
        annotations: [],
        replies: [],
        updatedAt: nowIso(),
      };
      store[message.id] = rec;
      return rec;
    },

    claim(messageId, assignee) {
      const rec = requireRecord(messageId);
      if (rec.status !== "unassigned" && rec.status !== "resolved") {
        throw new TriageTransitionError(rec.status, "claimed");
      }
      const next: TriageRecord = {
        ...rec,
        status: "claimed",
        assignee,
      };
      return save(next);
    },

    release(messageId) {
      const rec = requireRecord(messageId);
      if (rec.status === "unassigned") return rec;
      const next: TriageRecord = {
        ...rec,
        status: "unassigned",
        assignee: null,
      };
      return save(next);
    },

    setStatus(messageId, status) {
      const rec = requireRecord(messageId);
      if (!isAllowedTransition(rec.status, status)) {
        throw new TriageTransitionError(rec.status, status);
      }
      const next: TriageRecord = {
        ...rec,
        status,
        assignee: status === "unassigned" ? null : rec.assignee,
      };
      return save(next);
    },

    annotate(messageId, author, body) {
      const rec = requireRecord(messageId);
      const annotation: Annotation = {
        id: genId("anno"),
        messageId,
        author,
        body,
        createdAt: nowIso(),
      };
      const next: TriageRecord = {
        ...rec,
        annotations: [...rec.annotations, annotation],
      };
      save(next);
      return annotation;
    },

    reply(messageId, author, body) {
      const rec = requireRecord(messageId);
      const reply: TeamReply = {
        id: genId("reply"),
        messageId,
        author,
        body,
        sentAt: nowIso(),
      };
      const next: TriageRecord = {
        ...rec,
        replies: [...rec.replies, reply],
      };
      save(next);
      return reply;
    },

    get(messageId) {
      return store[messageId];
    },

    list(status) {
      const all = allRecords();
      return status ? all.filter((r) => r.status === status) : all;
    },
  };
}
