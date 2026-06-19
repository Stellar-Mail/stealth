import type { DemoDataset, DemoMessage } from "../types/dataset";
import { inboxSeedFolderMap } from "../fixtures/inboxSeedMetadata";

export interface LocalInboxPreviewRow {
  id: string;
  threadId: string;
  subject: string;
  senderName: string;
  senderAddress: string;
  folder: string;
  date: string;
  snippet: string;
  labels: string[];
  isRead: boolean;
  isStarred: boolean;
  hasProof: boolean;
  hasAttachments: boolean;
  hasCalendarEvent: boolean;
  isSnoozed: boolean;
}

export interface LocalInboxPreviewReader {
  row: LocalInboxPreviewRow;
  body: string;
  recipients: string[];
  attachmentNames: string[];
  proofStatus: string;
  calendarTitle: string | null;
}

export function getLocalInboxPreviewRows(dataset: DemoDataset): LocalInboxPreviewRow[] {
  return dataset.messages
    .map((message) => toPreviewRow(message))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getLocalInboxPreviewRowsForFolder(
  dataset: DemoDataset,
  folder: string,
): LocalInboxPreviewRow[] {
  return getLocalInboxPreviewRows(dataset).filter((row) => row.folder === folder);
}

export function getLocalInboxPreviewReader(
  dataset: DemoDataset,
  selectedId?: string | null,
): LocalInboxPreviewReader | null {
  const rows = getLocalInboxPreviewRows(dataset);
  const selectedRow =
    rows.find((row) => row.id === selectedId) ?? rows.find((row) => !row.isRead) ?? rows[0] ?? null;

  if (!selectedRow) {
    return null;
  }

  const message = dataset.messages.find((item) => item.id === selectedRow.id);
  if (!message) {
    return null;
  }

  return {
    row: selectedRow,
    body: message.body,
    recipients: [...message.recipients],
    attachmentNames: message.attachments.map((attachment) => attachment.filename),
    proofStatus: message.proofRecord?.status ?? "none",
    calendarTitle: message.calendarEvent?.title ?? null,
  };
}

export function formatLocalInboxPreviewSubtitle(row: LocalInboxPreviewRow): string {
  const state = row.isRead ? "read" : "unread";
  const star = row.isStarred ? ", starred" : "";
  return `${row.folder} / ${state}${star}`;
}

function toPreviewRow(message: DemoMessage): LocalInboxPreviewRow {
  return {
    id: message.id,
    threadId: message.threadId,
    subject: message.subject,
    senderName: message.sender.name ?? message.sender.address,
    senderAddress: message.sender.address,
    folder: inboxSeedFolderMap[message.id] ?? "unknown",
    date: message.date,
    snippet: message.snippet,
    labels: [...message.labels],
    isRead: message.isRead,
    isStarred: message.isStarred,
    hasProof: message.proofRecord != null,
    hasAttachments: message.attachments.length > 0,
    hasCalendarEvent: message.calendarEvent != null,
    isSnoozed: message.snoozeRemindAt != null,
  };
}
