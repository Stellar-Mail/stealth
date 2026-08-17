/**
 * Core TypeScript types for the editable demo dataset.
 *
 * IMPORTANT: All data conforming to these types must remain safe, fake, and
 * deterministic. Do not include real user data, PII, live network secrets,
 * or non-deterministic values (like Date.now() or Math.random()).
 *
 * Email addresses must use `@example.com`, `@example.org`, or `*.stealth.demo`.
 */

/**
 * Represents a proof record for a demo protocol event.
 * Used to simulate cryptographic proofs or postage without real secrets.
 */
export interface DemoProofRecord {
  id: string;
  status: "verified" | "pending" | "failed" | "none";
  /** ISO 8601 local stamp */
  timestamp: string;
  /** Represented in fake currency or protocol tokens */
  postageAmount?: number;
  postageCurrency?: string;
  policyId?: string;
}

/**
 * Represents a sender in the demo ecosystem.
 */
export interface DemoSender {
  /** Must use safe domains: example.com, example.org, or *.stealth.demo */
  address: string;
  name?: string;
  avatarUrl?: string;
  isTrusted: boolean;
  relayNode?: string;
}

/**
 * File attachment details linked to a demo message.
 */
export interface DemoAttachment {
  id: string;
  filename: string;
  contentType: string;
  /** Size in bytes for UI rendering */
  sizeBytes: number;
  /** Fake URL for demo purposes */
  url: string;
}

/**
 * Calendar event details linked to a demo message.
 */
export interface DemoCalendarEvent {
  id: string;
  title: string;
  /** ISO 8601 local stamp (e.g. yyyy-MM-ddTHH:mm) */
  startTime: string;
  /** ISO 8601 local stamp (e.g. yyyy-MM-ddTHH:mm) */
  endTime: string;
  location?: string;
  /** List of safe email addresses */
  attendees: string[];
}

/**
 * The core email/message item for the demo inbox.
 */
export interface DemoMessage {
  id: string;
  threadId: string;
  subject: string;
  snippet: string;
  /** HTML or plain text body (must not contain real PII) */
  body: string;
  sender: DemoSender;
  /** Safe recipient addresses */
  recipients: string[];
  /** ISO 8601 local stamp */
  date: string;
  isRead: boolean;
  isStarred: boolean;
  /** Local yyyy-MM-ddTHH:mm stamp, if snoozed */
  snoozeRemindAt?: string;
  labels: string[];
  attachments: DemoAttachment[];
  proofRecord?: DemoProofRecord;
  calendarEvent?: DemoCalendarEvent;
}

/**
 * An aggregate root representing an entire editable demo dataset.
 */
export interface DemoDataset {
  id: string;
  name: string;
  description: string;
  messages: DemoMessage[];
  senders?: DemoSender[];
}
