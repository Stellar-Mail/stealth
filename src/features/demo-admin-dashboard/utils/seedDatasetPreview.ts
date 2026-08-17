import type { DemoDataset } from "../types/dataset";
import { inboxSeedFolderMap, inboxSeedMetadata } from "../fixtures/inboxSeedMetadata";

export interface SeedDatasetPreview {
  id: string;
  name: string;
  description: string;
  totalMessages: number;
  uniqueSenders: number;
  folderBreakdown: Array<{ folder: string; count: number }>;
  labelBreakdown: Array<{ label: string; count: number }>;
  stats: {
    read: number;
    unread: number;
    starred: number;
    withProof: number;
    withAttachments: number;
    withCalendarEvent: number;
    snoozed: number;
  };
}

export function getSeedDatasetPreview(dataset: DemoDataset): SeedDatasetPreview {
  const labelCounts = inboxSeedMetadata.labelCounts;
  const labelBreakdown = Object.entries(labelCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const folderCounts: Record<string, number> = {};
  for (const msg of dataset.messages) {
    const folder = inboxSeedFolderMap[msg.id] ?? "unknown";
    folderCounts[folder] = (folderCounts[folder] ?? 0) + 1;
  }
  const folderBreakdown = Object.entries(folderCounts)
    .map(([folder, count]) => ({ folder, count }))
    .sort((a, b) => b.count - a.count);

  const senderSet = new Set(dataset.senders?.map((s) => s.address.toLowerCase()));
  for (const msg of dataset.messages) {
    senderSet.add(msg.sender.address.toLowerCase());
  }

  return {
    id: dataset.id,
    name: dataset.name,
    description: dataset.description,
    totalMessages: dataset.messages.length,
    uniqueSenders: senderSet.size,
    folderBreakdown,
    labelBreakdown,
    stats: {
      read: inboxSeedMetadata.readCount,
      unread: inboxSeedMetadata.unreadCount,
      starred: inboxSeedMetadata.starredCount,
      withProof: inboxSeedMetadata.messagesWithProof,
      withAttachments: inboxSeedMetadata.messagesWithAttachments,
      withCalendarEvent: inboxSeedMetadata.messagesWithCalendarEvent,
      snoozed: inboxSeedMetadata.snoozedMessages,
    },
  };
}
