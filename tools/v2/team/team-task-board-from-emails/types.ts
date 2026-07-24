/**
 * Represents an action-oriented email from a shared mailbox.
 */
export interface Email {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  receivedAt: string; // ISO date-time string
  body: string;
  signals?: string[]; // Optional NLP/heuristics hints
}

/**
 * Represents a board task card derived from an email thread.
 */
export interface TaskCard {
  id: string;
  title: string;
  owner: string; // Assigned team member, department, or "unassigned"
  dueDate: string | null; // ISO date string (YYYY-MM-DD) or null
  priority: "low" | "medium" | "high";
  status: "new" | "triage" | "blocked" | "done";
  sourceEmailId: string;
  reviewRequired: boolean;
  notes?: string; // Optional context or reasoning for review
}

/**
 * Grouping structure for the task board columns.
 */
export interface TaskBoard {
  new: TaskCard[];
  triage: TaskCard[];
  blocked: TaskCard[];
  done: TaskCard[];
}

/**
 * UI loading and error states for service consumption.
 */
export type LoadState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: T };

/**
 * Service configuration parameters.
 */
export interface TaskBoardServiceConfig {
  simulateDelay?: boolean;
  delayMs?: number;
  failureRate?: number;
}
