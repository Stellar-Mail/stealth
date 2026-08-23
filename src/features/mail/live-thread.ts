// ---------------------------------------------------------------------------
// BETA-055 (Issue #1962) — live thread model from verified/decrypted envelopes.
// ---------------------------------------------------------------------------

import type { Email, EncryptedPayload, PayloadFailureReason } from "@/components/mail/data";
import type { MailboxSealedMessage } from "@/lib/api";
import type { KeyProvider, VerifiedEnvelopeProvenance } from "@/services/crypto/open-envelope";
import type { QuarantinedMailRecord } from "./quarantine";
import { processInboundEnvelope } from "./recipient-pipeline";
import type { IsolatedRemoteResources, SafeMailContent } from "./safe-rendering";
import { threadIdFromDescriptor } from "./live-mailbox";

export const LIVE_THREAD_MESSAGE_CAP = 12;

export type ThreadMessageTrust = "verified" | "unverified" | "quarantined" | "locked";

export interface ThreadMessage {
  messageId: string;
  createdAt: string;
  subject: string;
  senderId: string;
  recipientId: string;
  trust: ThreadMessageTrust;
  authenticityWarning: string | null;
  sender: string;
  timestamp: string;
  attachments: { name: string; size: string; type: string }[];
  provenance?: VerifiedEnvelopeProvenance;
  safeContent?: SafeMailContent;
  remoteResources: IsolatedRemoteResources;
  quarantineRecord?: QuarantinedMailRecord;
  encryptedPayload: EncryptedPayload;
}

export interface MailThread {
  threadId: string;
  subject: string;
  selectedId: string;
  messages: ThreadMessage[];
  mixedState: boolean;
}

const EMPTY_REMOTE: IsolatedRemoteResources = { blockedUrls: [], blockedCount: 0 };

export function canRenderBody(message: ThreadMessage): boolean {
  return message.trust === "verified" || message.trust === "unverified";
}

export function isTrustedContent(message: ThreadMessage): boolean {
  return message.trust === "verified";
}

export function siblingMessageIds(
  emails: Email[],
  selectedId: string,
  cap = LIVE_THREAD_MESSAGE_CAP,
): string[] {
  const selected = emails.find((email) => email.id === selectedId);
  if (!selected) return [selectedId];
  const threadId = selected.threadId ?? selected.id;
  const ids = emails
    .filter((email) => (email.threadId ?? email.id) === threadId)
    .map((email) => email.id);
  if (!ids.includes(selectedId)) ids.unshift(selectedId);
  const unique = [...new Set(ids)];
  if (unique.length <= cap) return unique;
  const rest = unique.filter((id) => id !== selectedId).slice(0, cap - 1);
  return [selectedId, ...rest];
}

function headerString(headers: Record<string, unknown>, key: string): string | null {
  const value = headers[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentType(filename: string, contentType: string): string {
  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
  if (ext) return ext;
  const subtype = contentType.split("/")[1];
  return subtype || "file";
}

function failureReason(record?: QuarantinedMailRecord): PayloadFailureReason {
  if (!record) return "payload";
  if (record.reasonCode === "decryption_error") return "key";
  if (record.reasonCode === "integrity_error" || record.reasonCode === "signature_error") {
    return "integrity";
  }
  return "payload";
}

function payloadFor(
  status: EncryptedPayload["status"],
  diagnosticId: string,
  reason?: PayloadFailureReason,
): EncryptedPayload {
  return {
    status,
    diagnosticId,
    ...(status === "failed" && reason ? { failureReason: reason } : {}),
  };
}

export async function openSealedMailboxMessage(
  sealed: MailboxSealedMessage,
  keys: KeyProvider,
  expectedRecipient?: string,
): Promise<ThreadMessage> {
  const headers = sealed.protectedHeaders ?? {};
  const subject = headerString(headers, "subject") ?? "Encrypted message";
  const base = {
    messageId: sealed.messageId,
    createdAt: sealed.createdAt,
    subject,
    senderId: sealed.senderId,
    recipientId: sealed.recipientId,
    sender: headerString(headers, "from") ?? sealed.senderId,
    timestamp: sealed.createdAt,
    attachments: [] as ThreadMessage["attachments"],
    remoteResources: EMPTY_REMOTE,
  };

  if (!sealed.ciphertext || sealed.payload == null) {
    const quarantine = {
      diagnosticId: `quar-${sealed.messageId.slice(0, 4)}-${sealed.messageId.slice(4, 8)}`,
      quarantinedAt: new Date().toISOString(),
      reasonCode: "schema_error" as const,
      userHeadline: "Envelope Schema Error",
      userDetail: "The sealed envelope is missing ciphertext or payload metadata.",
      sender: sealed.senderId,
      recipient: sealed.recipientId,
    };
    return {
      ...base,
      trust: "quarantined",
      authenticityWarning: quarantine.userDetail,
      quarantineRecord: quarantine,
      encryptedPayload: payloadFor("failed", quarantine.diagnosticId, "payload"),
    };
  }

  const hasSignature = Boolean(sealed.signature);
  const result = await processInboundEnvelope({
    input: {
      payload: sealed.payload,
      ciphertext: sealed.ciphertext,
      signature: sealed.signature ?? undefined,
    },
    keys,
    expectedRecipient: expectedRecipient ?? sealed.recipientId,
    expectedSender: sealed.senderId,
    requireSenderSignature: hasSignature,
  });

  if (result.status === "quarantined") {
    const reason = failureReason(result.quarantineRecord);
    const locked = reason === "key";
    return {
      ...base,
      trust: locked ? "locked" : "quarantined",
      authenticityWarning: result.quarantineRecord.userDetail,
      quarantineRecord: result.quarantineRecord,
      encryptedPayload: payloadFor("failed", result.quarantineRecord.diagnosticId, reason),
    };
  }

  const verified =
    result.provenance.senderVerified === true || result.provenance.signatureVerified === true;
  const attachments = result.opened.attachments.map((attachment) => ({
    name: attachment.filename,
    size: formatBytes(attachment.size_bytes),
    type: attachmentType(attachment.filename, attachment.content_type),
  }));
  const blocked = result.safeContent.remoteResources.blockedCount;
  const warning = verified
    ? blocked > 0
      ? `${blocked} remote resource${blocked === 1 ? "" : "s"} blocked for privacy.`
      : null
    : "Sender authenticity is not verified. Content is sanitized and not marked trusted.";

  return {
    ...base,
    sender: result.provenance.sender || base.sender,
    timestamp: result.provenance.timestamp || base.timestamp,
    trust: verified ? "verified" : "unverified",
    authenticityWarning: warning,
    attachments,
    provenance: result.provenance,
    safeContent: result.safeContent,
    remoteResources: result.safeContent.remoteResources,
    encryptedPayload: payloadFor("decrypted", result.provenance.digest.slice(0, 12)),
  };
}

export async function buildMailThread(
  sealedMessages: MailboxSealedMessage[],
  keys: KeyProvider,
  selectedId: string,
  expectedRecipient?: string,
): Promise<MailThread> {
  const opened = await Promise.all(
    sealedMessages.map((sealed) => openSealedMailboxMessage(sealed, keys, expectedRecipient)),
  );
  const messages = opened.sort((a, b) => {
    const byTime = a.createdAt.localeCompare(b.createdAt);
    return byTime !== 0 ? byTime : a.messageId.localeCompare(b.messageId);
  });
  const selected =
    sealedMessages.find((item) => item.messageId === selectedId) ?? sealedMessages[0];
  const trusts = new Set(messages.map((message) => message.trust));
  return {
    threadId: selected ? threadIdFromDescriptor(selected) : selectedId,
    subject:
      messages.find((message) => message.messageId === selectedId)?.subject ?? "Conversation",
    selectedId,
    messages,
    mixedState: trusts.size > 1,
  };
}

export function applyThreadMessageToEmail(email: Email, message: ThreadMessage): Email {
  const renderBody = canRenderBody(message);
  const body = renderBody ? (message.safeContent?.rawCleanText ?? "") : "";
  const preview = renderBody
    ? (body
        .split(/\r?\n/)
        .find((line) => line.trim())
        ?.slice(0, 140) ?? email.preview)
    : (message.quarantineRecord?.userHeadline ?? "Encrypted payload");
  return {
    ...email,
    from: message.sender || email.from,
    email: message.senderId || email.email,
    subject: message.subject || email.subject,
    preview,
    body,
    time: formatReaderTime(message.timestamp || email.time),
    attachments: message.attachments.length ? message.attachments : email.attachments,
    verifiedSender: message.trust === "verified",
    encryptedPayload: message.encryptedPayload,
    provenanceData: message.provenance,
    quarantineRecord: message.quarantineRecord,
    threadId: email.threadId,
  };
}

function formatReaderTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
