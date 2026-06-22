export type DeadlineId = string;
export type DeadlineSourceId = string;

export type DeadlineStatus = "detected" | "needs-review" | "missed" | "ignored";
export type DeadlineUrgency = "overdue" | "today" | "soon" | "later" | "unknown";
export type DeadlineSourceType = "email" | "calendar-forward" | "invoice" | "project-update";

export interface DeadlineMessage {
  id: DeadlineSourceId;
  type: DeadlineSourceType;
  sender: string;
  subject: string;
  body: string;
  receivedAt: string;
  containsPersonalData: boolean;
  userTimezone: string;
}

export interface DetectedDeadline {
  id: DeadlineId;
  sourceMessageId: DeadlineSourceId;
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  timezone: string;
  status: DeadlineStatus;
  urgency: DeadlineUrgency;
  confidence: number;
  evidence: string;
  suggestedAction: string;
  reviewRequired: boolean;
}

export interface DeadlineDetectionSummary {
  totalMessages: number;
  totalDeadlines: number;
  detected: number;
  needsReview: number;
  missed: number;
  ignored: number;
}

export interface DeadlineDetectionResult {
  deadlines: DetectedDeadline[];
  summary: DeadlineDetectionSummary;
}

export interface DeadlineDetectorServiceOptions {
  now?: string;
  defaultTimezone?: string;
}
