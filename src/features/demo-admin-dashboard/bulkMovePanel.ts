import {
  MESSAGE_FOLDERS,
  type EditableMessage,
  type MessageFolder,
} from "./constants/messageListEditorModel";
import { FOLDER_DEFINITIONS } from "./constants/folderTaxonomy";

export interface BulkMoveMessageChange {
  id: string;
  subject: string;
  fromFolder: MessageFolder;
  toFolder: MessageFolder;
  applied: boolean;
  skippedReason?: string;
}

export interface BulkMoveAuditSummary {
  targetFolder: MessageFolder;
  selectedCount: number;
  movedCount: number;
  skippedCount: number;
}

export interface BulkMoveEditResult {
  messages: EditableMessage[];
  targetFolder: MessageFolder;
  changes: BulkMoveMessageChange[];
  summary: BulkMoveAuditSummary;
}

export type BulkMoveValidation = { ok: true } | { ok: false; error: string };

export function isValidMessageFolder(folder: string): folder is MessageFolder {
  return (MESSAGE_FOLDERS as readonly string[]).includes(folder);
}

export function getMessageFolderLabel(folder: MessageFolder): string {
  return FOLDER_DEFINITIONS[folder].label;
}

export function validateBulkFolderMove(
  messages: EditableMessage[],
  selectedIds: string[],
  targetFolder: string,
): BulkMoveValidation {
  if (selectedIds.length === 0) {
    return { ok: false, error: "Select at least one message to move." };
  }

  if (!isValidMessageFolder(targetFolder)) {
    return { ok: false, error: "Choose a valid destination folder." };
  }

  const knownIds = new Set(messages.map((message) => message.id));
  const missingIds = selectedIds.filter((id) => !knownIds.has(id));
  if (missingIds.length > 0) {
    return { ok: false, error: `Unknown message id(s): ${missingIds.join(", ")}` };
  }

  return { ok: true };
}

export function previewBulkFolderMove(
  messages: EditableMessage[],
  selectedIds: string[],
  targetFolder: MessageFolder,
): BulkMoveAuditSummary {
  const selected = new Set(selectedIds);
  let movedCount = 0;
  let skippedCount = 0;

  for (const message of messages) {
    if (!selected.has(message.id)) {
      continue;
    }
    if (message.folder === targetFolder) {
      skippedCount++;
    } else {
      movedCount++;
    }
  }

  return {
    targetFolder,
    selectedCount: selectedIds.length,
    movedCount,
    skippedCount,
  };
}

export function applyBulkFolderMove(
  messages: EditableMessage[],
  selectedIds: string[],
  targetFolder: MessageFolder,
): BulkMoveEditResult {
  const selected = new Set(selectedIds);
  const changes: BulkMoveMessageChange[] = [];

  const nextMessages = messages.map((message) => {
    if (!selected.has(message.id)) {
      return message;
    }

    const fromFolder = message.folder;
    if (fromFolder === targetFolder) {
      changes.push({
        id: message.id,
        subject: message.subject,
        fromFolder,
        toFolder: targetFolder,
        applied: false,
        skippedReason: "already in target folder",
      });
      return message;
    }

    changes.push({
      id: message.id,
      subject: message.subject,
      fromFolder,
      toFolder: targetFolder,
      applied: true,
    });
    return { ...message, folder: targetFolder };
  });

  const movedCount = changes.filter((change) => change.applied).length;
  const skippedCount = changes.filter((change) => !change.applied).length;

  return {
    messages: nextMessages,
    targetFolder,
    changes,
    summary: {
      targetFolder,
      selectedCount: changes.length,
      movedCount,
      skippedCount,
    },
  };
}

export function summarizeBulkFolderMove(result: BulkMoveEditResult): string {
  const { summary } = result;
  const targetLabel = getMessageFolderLabel(summary.targetFolder);

  if (summary.movedCount === 0) {
    const reason =
      summary.skippedCount > 0 ? "all already in the target folder" : "no messages selected";
    return `No changes — ${reason} (${summary.skippedCount} skipped).`;
  }

  const messageWord = summary.movedCount === 1 ? "message" : "messages";
  const base = `Moved ${summary.movedCount} ${messageWord} to ${targetLabel}`;

  if (summary.skippedCount === 0) {
    return `${base}.`;
  }

  return `${base} (${summary.skippedCount} skipped — already in ${targetLabel}).`;
}
