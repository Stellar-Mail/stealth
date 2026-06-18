import {
  addDays,
  addHours,
  nextMonday,
  setHours,
  setMinutes,
  setSeconds,
  startOfDay,
} from "date-fns";
import { getFolderLabel, type Email, type MailFolder, type MailLocation } from "./data";
import {
  resolveSenderConversion,
  type SenderPolicyChoice,
} from "@/features/sender-conversion/types";

export type BulkActionId =
  | "archive"
  | "star"
  | "snooze"
  | "mark-read"
  | "approve"
  | "block"
  | "move";

export type BulkSnoozeChoice = "later-today" | "tomorrow" | "next-week";

export type BulkActionRequest =
  | { action: "archive" }
  | { action: "star"; value: boolean }
  | { action: "snooze"; snoozeChoice: BulkSnoozeChoice }
  | { action: "mark-read" }
  | { action: "approve" }
  | { action: "block" }
  | { action: "move"; folder: MailLocation };

export type BulkFailure = {
  id: string;
  subject: string;
  reason: string;
};

export type BulkProgressState = {
  action: BulkActionId;
  label: string;
  total: number;
  completed: number;
  failures: BulkFailure[];
};

export type BulkActionConfirmation = {
  title: string;
  description: string;
  confirmLabel: string;
};

export const PROTOCOL_FOLDERS = new Set<MailLocation>([
  "verified",
  "pending",
  "requests",
  "encrypted",
]);

export const MOVE_FOLDERS: MailLocation[] = ["inbox", "priority", "archive", "spam", "trash"];

const NON_MOVABLE_FOLDERS = new Set<MailLocation>([
  "sent",
  "outbox",
  "scheduled",
  "drafts",
  "trash",
]);

const NON_SNOOZABLE_FOLDERS = new Set<MailLocation>([
  "sent",
  "outbox",
  "scheduled",
  "drafts",
  "trash",
  "spam",
  "snoozed",
]);

const BULK_ACTIONS: BulkActionId[] = [
  "archive",
  "star",
  "snooze",
  "mark-read",
  "approve",
  "block",
  "move",
];

const SNOOZE_LABELS: Record<BulkSnoozeChoice, string> = {
  "later-today": "Later today",
  tomorrow: "Tomorrow",
  "next-week": "Next week",
};

function resolveBulkSnoozePreset(choice: BulkSnoozeChoice, now: Date) {
  const at = (day: Date, hour: number, minute = 0) =>
    setSeconds(setMinutes(setHours(startOfDay(day), hour), minute), 0);

  if (choice === "later-today") {
    const evening = at(now, 18);
    const threeHours = addHours(now, 3);
    return threeHours.getTime() > evening.getTime() ? evening : threeHours;
  }
  if (choice === "tomorrow") return at(addDays(now, 1), 9);
  return at(nextMonday(now), 9);
}

function buildBulkSnoozeState(choice: BulkSnoozeChoice, remindAt: Date, now: Date) {
  return {
    remindAt: remindAt.toISOString(),
    choice,
    label: SNOOZE_LABELS[choice],
    createdAt: now.toISOString(),
  };
}

export function isProtocolFolder(folder: MailFolder | MailLocation) {
  return PROTOCOL_FOLDERS.has(folder as MailLocation);
}

export function getBulkActionIdsForContext(
  emails: Email[],
  folder: MailFolder,
  customFolder?: string | null,
) {
  const currentFolderIsProtocol = !customFolder && isProtocolFolder(folder);

  return BULK_ACTIONS.filter((action) => {
    if (
      currentFolderIsProtocol &&
      (action === "archive" || action === "snooze" || action === "move")
    ) {
      return false;
    }

    return emails.some((email) => {
      if (action === "move") {
        return MOVE_FOLDERS.some((target) =>
          canApplyBulkActionToEmail({ action, folder: target }, email),
        );
      }
      return canApplyBulkActionToEmail(actionRequest(action), email);
    });
  });
}

export function canApplyBulkActionToEmail(request: BulkActionRequest, email: Email) {
  switch (request.action) {
    case "archive":
      return canArchiveEmail(email);
    case "star":
      return true;
    case "snooze":
      return canSnoozeEmail(email);
    case "mark-read":
      return email.unread;
    case "approve":
      return canApproveEmail(email);
    case "block":
      return canBlockEmail(email);
    case "move":
      return canMoveEmail(email) && request.folder !== email.folder;
  }
}

export function buildBulkActionPatch(
  request: BulkActionRequest,
  email: Email,
  now = new Date(),
): { ok: true; patch: Partial<Email> } | { ok: false; reason: string } {
  if (!canApplyBulkActionToEmail(request, email)) {
    return { ok: false, reason: getBulkActionFailureReason(request, email) };
  }

  switch (request.action) {
    case "archive":
      return { ok: true, patch: { folder: "archive" } };
    case "star":
      return { ok: true, patch: { starred: request.value } };
    case "snooze": {
      const remindAt = resolveBulkSnoozePreset(request.snoozeChoice, now);
      const state = buildBulkSnoozeState(request.snoozeChoice, remindAt, now);
      return { ok: true, patch: { folder: "snoozed", time: state.label, snooze: state } };
    }
    case "mark-read":
      return { ok: true, patch: { unread: false } };
    case "approve":
      return { ok: true, patch: resolveSenderConversion(email, "allow").patch };
    case "block":
      return { ok: true, patch: resolveSenderConversion(email, "block").patch };
    case "move":
      return { ok: true, patch: { folder: request.folder } };
  }
}

export function getBulkActionConfirmation(
  request: BulkActionRequest,
  emails: Email[],
): BulkActionConfirmation | null {
  const count = emails.length;
  const subject = count === 1 ? "conversation" : "conversations";

  switch (request.action) {
    case "archive":
      return {
        title: `Archive ${count} ${subject}?`,
        description: "They will move to Archive and disappear from this view.",
        confirmLabel: "Archive",
      };
    case "block":
      return {
        title: `Block ${count} sender${count === 1 ? "" : "s"}?`,
        description: "Their mail moves to Spam and any postage is marked for refund.",
        confirmLabel: "Block senders",
      };
    case "approve":
      return {
        title: `Approve ${count} sender${count === 1 ? "" : "s"}?`,
        description: "Future mail from these senders will skip request review and land in Inbox.",
        confirmLabel: "Approve senders",
      };
    case "move":
      return {
        title: `Move ${count} ${subject} to ${getFolderLabel(request.folder)}?`,
        description:
          request.folder === "trash" || request.folder === "spam"
            ? "This is a destructive protocol change and may affect delivery state."
            : "These conversations will be filed under the selected folder.",
        confirmLabel: "Move",
      };
    case "snooze": {
      return {
        title: `Snooze ${count} ${subject} until ${SNOOZE_LABELS[request.snoozeChoice]}?`,
        description: "They will return to Inbox at the selected time.",
        confirmLabel: "Snooze",
      };
    }
    case "star":
    case "mark-read":
      return null;
  }
}

export function getBulkActionLabel(request: BulkActionRequest) {
  switch (request.action) {
    case "archive":
      return "Archive";
    case "star":
      return request.value ? "Star" : "Unstar";
    case "snooze":
      return `Snooze until ${SNOOZE_LABELS[request.snoozeChoice]}`;
    case "mark-read":
      return "Mark read";
    case "approve":
      return "Approve senders";
    case "block":
      return "Block senders";
    case "move":
      return `Move to ${getFolderLabel(request.folder)}`;
  }
}

export function getBulkActionProgressLabel(request: BulkActionRequest, total: number) {
  return `${getBulkActionLabel(request)} · ${total} selected`;
}

function actionRequest(action: Exclude<BulkActionId, "move">): BulkActionRequest {
  switch (action) {
    case "archive":
      return { action };
    case "star":
      return { action, value: true };
    case "snooze":
      return { action, snoozeChoice: "tomorrow" };
    case "mark-read":
      return { action };
    case "approve":
      return { action };
    case "block":
      return { action };
  }
}

function canArchiveEmail(email: Email) {
  return (
    email.folder !== "archive" && email.folder !== "trash" && !PROTOCOL_FOLDERS.has(email.folder)
  );
}

function canSnoozeEmail(email: Email) {
  return !NON_SNOOZABLE_FOLDERS.has(email.folder) && !PROTOCOL_FOLDERS.has(email.folder);
}

export function canMoveEmail(email: Email) {
  return !NON_MOVABLE_FOLDERS.has(email.folder) && !PROTOCOL_FOLDERS.has(email.folder);
}

function canApproveEmail(email: Email) {
  return (
    email.folder === "requests" && email.senderPolicy !== "allow" && email.senderPolicy !== "block"
  );
}

function canBlockEmail(email: Email) {
  return (
    email.senderPolicy !== "block" &&
    !["sent", "outbox", "scheduled", "drafts"].includes(email.folder)
  );
}

function getBulkActionFailureReason(request: BulkActionRequest, email: Email) {
  switch (request.action) {
    case "archive":
      if (email.folder === "archive") return "Already archived.";
      if (email.folder === "trash") return "Trash messages cannot be archived.";
      return "Protocol messages cannot be archived in bulk.";
    case "star":
      return "This message cannot be starred.";
    case "snooze":
      if (email.folder === "snoozed") return "Already snoozed.";
      if (PROTOCOL_FOLDERS.has(email.folder)) return "Protocol messages cannot be snoozed in bulk.";
      return "This message cannot be snoozed.";
    case "mark-read":
      return "Already read.";
    case "approve":
      if (email.senderPolicy === "allow") return "Sender is already approved.";
      if (email.senderPolicy === "block") return "Sender is already blocked.";
      return "Approval applies to request messages.";
    case "block":
      if (email.senderPolicy === "block") return "Sender is already blocked.";
      return "This message cannot be blocked.";
    case "move":
      if (request.folder === email.folder) return "Already in this folder.";
      if (PROTOCOL_FOLDERS.has(email.folder)) return "Protocol messages cannot be moved in bulk.";
      return "This message cannot be moved.";
  }
}
