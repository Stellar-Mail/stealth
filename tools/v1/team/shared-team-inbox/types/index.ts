/**
 * Shared Team Inbox — shared types (#445).
 *
 * Folder-local types only. No imports from the main application.
 */

/** A message delivered to the shared team identity. */
export interface TeamMessage {
  id: string;
  /** External sender address (sender-invisible annotations never reach this). */
  sender: string;
  subject: string;
  /** Optional body preview; never serialized to an external reply automatically. */
  preview?: string;
  receivedAt: string; // ISO-8601
}

/**
 * Triage lifecycle for a message assigned to the team.
 *   unassigned -> claimed -> in-progress -> awaiting-reply -> resolved
 * Any state may also return to `claimed` (re-opened) or be `unassigned`
 * (released). Once `resolved`, it is terminal.
 */
export type TriageStatus = "unassigned" | "claimed" | "in-progress" | "awaiting-reply" | "resolved";

/** A team-only annotation. Must never be included in any external reply. */
export interface Annotation {
  id: string;
  messageId: string;
  author: string; // team member identity
  body: string;
  createdAt: string; // ISO-8601
}

/** An external reply composed by the team using the shared identity. */
export interface TeamReply {
  id: string;
  messageId: string;
  author: string; // team member who sent it
  body: string;
  sentAt: string; // ISO-8601
}

/** Stored record combining the message with its triage/annotation state. */
export interface TriageRecord {
  message: TeamMessage;
  status: TriageStatus;
  /** Team member currently owning the message (null when unassigned). */
  assignee: string | null;
  annotations: Annotation[];
  replies: TeamReply[];
  updatedAt: string; // ISO-8601
}
