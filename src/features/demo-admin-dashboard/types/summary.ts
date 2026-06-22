/**
 * Types for the dataset summary and validation warnings.
 * Used to preview draft content before publishing to the demo environment.
 */

export type WarningSeverity = "info" | "warning" | "error";

export interface DataWarning {
  id: string;
  message: string;
  severity: WarningSeverity;
  category: "message" | "sender" | "dataset";
  targetId?: string; // e.g. msg-001 or sender address
}

export interface DatasetSummary {
  messageCount: number;
  senderCount: number;
  attachmentCount: number;
  calendarEventCount: number;
  unreadCount: number;
  starredCount: number;
  warnings: DataWarning[];
  totalSizeEstimate: number; // In bytes
}
