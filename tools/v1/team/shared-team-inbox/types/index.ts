export type MessageStatus =
  | 'unassigned'
  | 'claimed'
  | 'in-progress'
  | 'awaiting-reply'
  | 'resolved';

export interface SharedMessage {
  id: string;
  senderAddress: string;
  subject: string;
  body: string;
  preview: string;
  receivedAt: string;
  deliveryProofHash: string;
  status: MessageStatus;
  assigneeAddress?: string;
}

export interface Assignment {
  messageId: string;
  assignedTo: string;
  assignedAt: string;
  note?: string;
}

export interface InternalComment {
  id: string;
  messageId: string;
  author: string;
  body: string;
  createdAt: string;
  deleted: boolean;
}

export interface ActivityEvent {
  id: string;
  messageId: string;
  actor: string;
  action: string;
  timestamp: string;
  details?: string;
}

export type StorageEntry<T> = { id: string; data: T };

export interface StorageAdapter {
  get<T>(key: string): Promise<StorageEntry<T> | null>;
  getAll<T>(prefix: string): Promise<StorageEntry<T>[]>;
  set<T>(key: string, entry: StorageEntry<T>): Promise<void>;
  delete(key: string): Promise<void>;
}

export const VALID_TRANSITIONS: Record<MessageStatus, MessageStatus[]> = {
  'unassigned': ['claimed'],
  'claimed': ['in-progress', 'unassigned'],
  'in-progress': ['awaiting-reply', 'resolved'],
  'awaiting-reply': ['resolved', 'in-progress'],
  'resolved': ['in-progress'],
};

export function getNextStatuses(current: MessageStatus): MessageStatus[] {
  return VALID_TRANSITIONS[current] ?? [];
}

export const STATUS_LABELS: Record<MessageStatus, string> = {
  'unassigned': 'Unassigned',
  'claimed': 'Claimed',
  'in-progress': 'In Progress',
  'awaiting-reply': 'Awaiting Reply',
  'resolved': 'Resolved',
};
