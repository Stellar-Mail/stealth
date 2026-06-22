import type { DemoDataset, DemoMessage, DemoSender } from "../types/dataset";
import type { DatasetSummary, DataWarning, WarningSeverity } from "../types/summary";

/**
 * Validates email addresses against safe demo domains.
 */
function isSafeEmail(email: string): boolean {
  const safeDomains = ["example.com", "example.org", "stealth.demo"];
  return safeDomains.some((domain) => email.endsWith(domain) || email.endsWith("." + domain));
}

/**
 * Analyzes a demo dataset to generate a summary and identify potential issues.
 */
export function calculateDatasetSummary(dataset: DemoDataset): DatasetSummary {
  const warnings: DataWarning[] = [];
  let attachmentCount = 0;
  let calendarEventCount = 0;
  let unreadCount = 0;
  let starredCount = 0;
  let totalSizeEstimate = 0;

  // Validate Messages
  dataset.messages.forEach((msg) => {
    unreadCount += msg.isRead ? 0 : 1;
    starredCount += msg.isStarred ? 1 : 0;
    attachmentCount += msg.attachments.length;
    calendarEventCount += msg.calendarEvent ? 1 : 0;

    // Estimate size: subject + snippet + body + attachments
    totalSizeEstimate += (msg.subject.length + msg.snippet.length + msg.body.length) * 2; // ~2 bytes per char
    msg.attachments.forEach((a) => (totalSizeEstimate += a.sizeBytes));

    // Check for warnings
    if (!msg.subject.trim()) {
      warnings.push({
        id: `warn-subject-${msg.id}`,
        message: `Message "${msg.id}" has an empty subject.`,
        severity: "warning",
        category: "message",
        targetId: msg.id,
      });
    }

    if (msg.recipients.length === 0) {
      warnings.push({
        id: `warn-recipients-${msg.id}`,
        message: `Message "${msg.id}" has no recipients.`,
        severity: "error",
        category: "message",
        targetId: msg.id,
      });
    }

    msg.recipients.forEach((r) => {
      if (!isSafeEmail(r)) {
        warnings.push({
          id: `warn-email-unsafe-${msg.id}-${r}`,
          message: `Recipient "${r}" uses a non-demo domain.`,
          severity: "error",
          category: "message",
          targetId: msg.id,
        });
      }
    });

    if (!isSafeEmail(msg.sender.address)) {
      warnings.push({
        id: `warn-sender-unsafe-${msg.id}`,
        message: `Sender "${msg.sender.address}" uses a non-demo domain.`,
        severity: "error",
        category: "message",
        targetId: msg.id,
      });
    }
  });

  // Validate Senders
  dataset.senders?.forEach((sender) => {
    if (!sender.name) {
      warnings.push({
        id: `warn-sender-name-${sender.address}`,
        message: `Sender "${sender.address}" is missing a display name.`,
        severity: "info",
        category: "sender",
        targetId: sender.address,
      });
    }
  });

  return {
    messageCount: dataset.messages.length,
    senderCount: dataset.senders?.length || 0,
    attachmentCount,
    calendarEventCount,
    unreadCount,
    starredCount,
    warnings,
    totalSizeEstimate,
  };
}

/**
 * Formats a byte count into a human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
