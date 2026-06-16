import type { MailEvent } from "@/features/calendar";

export type MailFolder =
  | "all"
  | "inbox"
  | "priority"
  | "snoozed"
  | "verified"
  | "pending"
  | "requests"
  | "encrypted"
  | "receipts"
  | "starred"
  | "sent"
  | "outbox"
  | "drafts"
  | "scheduled"
  | "archive"
  | "spam"
  | "trash";

type VirtualMailFolder = "all" | "starred";

export type MailLocation = Exclude<MailFolder, VirtualMailFolder>;

export type Message = {
  id: string;
  from: string;
  email: string;
  subject: string;
  preview: string;
  body: string;
  timestamp: number;
  unread: boolean;
  starred: boolean;
  folder: MailLocation;
  labels?: string[];
  attachments?: { name: string; size: string; type: string }[];
  avatarColor: string;
  event?: MailEvent;
};

export type Thread = {
  id: string;
  messageIds: string[];
  subject: string;
  lastMessageTimestamp: number;
  unreadCount: number;
  participants: string[];
};

export type Contact = {
  address: string;
  name: string;
  email: string;
  verified: boolean;
  trusted: boolean;
  blockedSince?: number;
};

export type Policy = {
  allowUnknown: boolean;
  minimumPostage: string;
  requireVerified: boolean;
};

export type Proof = {
  id: string;
  messageId: string;
  type: "delivery" | "read";
  timestamp: number;
  status: "pending" | "settled";
};

export type SyncCursor = {
  id: string;
  timestamp: number;
  source: "local" | "testnet";
};

export type MailboxState = {
  version: number;
  messages: Message[];
  threads: Thread[];
  contacts: Contact[];
  policy: Policy;
  proofs: Proof[];
  syncCursor: SyncCursor;
};

export type LoadingState = "idle" | "loading" | "stale" | "error";

export type MailboxContext = {
  state: MailboxState;
  loadingState: LoadingState;
  error: Error | null;
  lastSync: number;
};

export type MailFilters = {
  unreadOnly: boolean;
  hasAttachments: boolean;
  dateRange: "all" | "today" | "week" | "month";
};
