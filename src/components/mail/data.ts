import type { MailEvent } from "@/features/calendar";
import type { Message, MailFolder, MailLocation, MailFilters } from "@/features/mailbox";

// Re-export types for backwards compatibility
export type { MailFolder, MailLocation, MailFilters };

// Legacy type alias for compatibility
export type Email = Message & {
  time: string; // Formatted time string for display
};

export const defaultMailFilters: MailFilters = {
  unreadOnly: false,
  hasAttachments: false,
  dateRange: "all",
};

/**
 * Convert Message timestamp to formatted time string
 */
export function formatMessageTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  // Less than a minute
  if (diff < 60000) return "just now";

  // Less than an hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }

  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return hours === 1 ? "1h ago" : `${hours}h ago`;
  }

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDate = new Date(timestamp);

  if (
    msgDate.getDate() === yesterday.getDate() &&
    msgDate.getMonth() === yesterday.getMonth() &&
    msgDate.getFullYear() === yesterday.getFullYear()
  ) {
    return "Yesterday";
  }

  // This week
  if (diff < 604800000) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[msgDate.getDay()];
  }

  // Format as date
  const month = (msgDate.getMonth() + 1).toString().padStart(2, "0");
  const day = msgDate.getDate().toString().padStart(2, "0");
  return `${month}/${day}`;
}

export const mailFolders: {
  key: MailFolder;
  label: string;
  group: "mail" | "protocol" | "delivery" | "storage";
}[] = [
  { key: "all", label: "All Mail", group: "mail" },
  { key: "inbox", label: "Inbox", group: "mail" },
  { key: "priority", label: "Priority", group: "mail" },
  { key: "snoozed", label: "Snoozed", group: "mail" },
  { key: "starred", label: "Starred", group: "mail" },
  { key: "drafts", label: "Drafts", group: "mail" },
  { key: "sent", label: "Sent", group: "mail" },
  { key: "verified", label: "Verified", group: "protocol" },
  { key: "pending", label: "Pending Proof", group: "protocol" },
  { key: "requests", label: "Requests", group: "protocol" },
  { key: "encrypted", label: "Encrypted", group: "protocol" },
  { key: "receipts", label: "Receipts", group: "delivery" },
  { key: "outbox", label: "Outbox", group: "delivery" },
  { key: "scheduled", label: "Scheduled", group: "delivery" },
  { key: "archive", label: "Archive", group: "storage" },
  { key: "spam", label: "Spam", group: "storage" },
  { key: "trash", label: "Trash", group: "storage" },
];

const inboxLocations = new Set<MailLocation>([
  "inbox",
  "priority",
  "verified",
  "pending",
  "requests",
  "encrypted",
]);

export function getFolderLabel(folder: MailFolder) {
  return mailFolders.find((item) => item.key === folder)?.label ?? folder;
}

export function getEmailsForFolder(allEmails: Email[], folder: MailFolder) {
  if (folder === "all")
    return allEmails.filter((email) => email.folder !== "spam" && email.folder !== "trash");
  if (folder === "starred") return allEmails.filter((email) => email.starred);
  if (folder === "inbox") return allEmails.filter((email) => inboxLocations.has(email.folder));
  return allEmails.filter((email) => email.folder === folder);
}

// Placeholder for seed data - will be populated from useMailbox
export const emails: Email[] = [];
