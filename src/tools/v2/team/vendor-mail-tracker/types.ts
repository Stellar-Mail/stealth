/**
 * Vendor Mail Tracker — local type definitions.
 *
 * All types are scoped to this tool folder and are not exported to the main
 * application. Future integration with the mail engine should be filed as a
 * separate follow-up issue.
 */

// ── Vendor ────────────────────────────────────────────────────────────────────

export type VendorStatus = "active" | "pending" | "paused" | "terminated";

export interface Vendor {
  id: string;
  name: string;
  domain: string;
  contactEmail: string;
  category: VendorCategory;
  status: VendorStatus;
  /** ISO-8601 date string. */
  contractStart: string;
  /** ISO-8601 date string, or null if open-ended. */
  contractEnd: string | null;
  /** Monthly spend in USD cents. */
  monthlySpendCents: number;
  /** Mailing address line 1. */
  address: string;
  /** Running count of tracked mail threads. */
  threadCount: number;
  notes: string;
}

export type VendorCategory =
  | "infrastructure"
  | "software"
  | "marketing"
  | "legal"
  | "finance"
  | "hr"
  | "logistics"
  | "other";

// ── Mail Thread ───────────────────────────────────────────────────────────────

export type ThreadStatus =
  | "open"
  | "awaiting-reply"
  | "resolved"
  | "escalated"
  | "flagged";

export type ThreadPriority = "low" | "medium" | "high" | "critical";

export interface VendorThread {
  id: string;
  vendorId: string;
  subject: string;
  lastMessageAt: string;
  /** UTC ISO-8601 string for when to follow up, or null. */
  followUpAt: string | null;
  status: ThreadStatus;
  priority: ThreadPriority;
  messageCount: number;
  /** Brief excerpt from the last message (at most 140 chars, no PII). */
  excerpt: string;
  /** True when the latest message has not been read by the team. */
  unread: boolean;
  tags: string[];
}

// ── Filter / Sort ─────────────────────────────────────────────────────────────

export type SortField = "lastMessageAt" | "vendor" | "priority" | "status" | "followUpAt";
export type SortDir = "asc" | "desc";

export interface TrackingFilter {
  query: string;
  status: ThreadStatus | "all";
  priority: ThreadPriority | "all";
  category: VendorCategory | "all";
  vendorId: string | "all";
}

// ── UI State ──────────────────────────────────────────────────────────────────

export type ViewMode = "list" | "board";

export type ToolUIState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "ready" };

// ── Form / Edit ───────────────────────────────────────────────────────────────

/** Subset used by the Add-Vendor form. */
export type VendorDraft = Omit<Vendor, "id" | "threadCount">;

/** Subset used by the Add-Thread form. */
export type ThreadDraft = Omit<VendorThread, "id" | "messageCount" | "lastMessageAt" | "unread">;
