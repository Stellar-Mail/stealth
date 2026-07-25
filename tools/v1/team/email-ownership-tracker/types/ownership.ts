export type ThreadId = string;
export type ActorId = string;
export type OwnershipEventId = string;

export type OwnershipAction = "assigned" | "reassigned" | "released" | "claimed";

export type OwnershipState = "owned" | "unassigned";

export type OwnershipAnomalyCode =
  | "release-without-owner"
  | "duplicate-owner-assignment"
  | "reassign-without-existing-owner"
  | "owner-mismatch"
  | "out-of-order-timestamp";

export interface OwnershipEvent {
  id: OwnershipEventId;
  threadId: ThreadId;
  action: OwnershipAction;
  actor: ActorId;
  owner: ActorId | null;
  previousOwner?: ActorId | null;
  timestamp: string;
  note?: string;
}

export interface OwnershipHistoryEntry {
  eventId: OwnershipEventId;
  action: OwnershipAction;
  actor: ActorId;
  owner: ActorId | null;
  previousOwner: ActorId | null;
  timestamp: string;
  note: string | null;
}

export interface OwnershipRecord {
  threadId: ThreadId;
  currentOwner: ActorId | null;
  state: OwnershipState;
  handoffCount: number;
  firstEventAt: string;
  lastEventAt: string;
  history: OwnershipHistoryEntry[];
}

export interface OwnershipAnomaly {
  eventId: OwnershipEventId;
  threadId: ThreadId;
  code: OwnershipAnomalyCode;
  message: string;
}

export interface OwnershipSummary {
  totalEvents: number;
  totalThreads: number;
  ownedThreads: number;
  unassignedThreads: number;
  totalHandoffs: number;
  anomalies: number;
}

export interface OwnershipReport {
  records: OwnershipRecord[];
  anomalies: OwnershipAnomaly[];
  summary: OwnershipSummary;
}
