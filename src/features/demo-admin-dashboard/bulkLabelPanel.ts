import { normalizeLabelName, toLabelId } from "./labels/labelNormalization";
import type { DemoMessage } from "./types/dataset";

export type BulkLabelOperation = "add" | "remove";

export interface BulkLabelMessageChange {
  id: string;
  subject: string;
  applied: string[];
  skipped: string[];
}

export interface BulkLabelAuditSummary {
  operation: BulkLabelOperation;
  selectedCount: number;
  affectedCount: number;
  totalApplied: number;
  totalSkipped: number;
}

export interface BulkLabelEditResult {
  messages: DemoMessage[];
  operation: BulkLabelOperation;
  requestedLabels: string[];
  changes: BulkLabelMessageChange[];
  summary: BulkLabelAuditSummary;
}

export function normalizeLabelsForBulk(labels: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of labels) {
    const normalized = normalizeLabelName(raw);
    const id = toLabelId(normalized);
    if (!normalized || !id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    result.push(normalized);
  }
  return result;
}

export function applyBulkLabelEdit(
  messages: DemoMessage[],
  selectedIds: string[],
  labels: string[],
  operation: BulkLabelOperation,
): BulkLabelEditResult {
  const requestedLabels = normalizeLabelsForBulk(labels);
  const selected = new Set(selectedIds);
  const changes: BulkLabelMessageChange[] = [];

  const nextMessages = messages.map((message) => {
    if (!selected.has(message.id)) {
      return message;
    }

    const existingLabelIds = new Set(message.labels.map((l) => toLabelId(l)));
    const applied: string[] = [];
    const skipped: string[] = [];

    if (operation === "add") {
      const nextLabels = [...message.labels];
      for (const label of requestedLabels) {
        const id = toLabelId(label);
        if (existingLabelIds.has(id)) {
          skipped.push(label);
        } else {
          existingLabelIds.add(id);
          nextLabels.push(label);
          applied.push(label);
        }
      }
      changes.push({ id: message.id, subject: message.subject, applied, skipped });
      return applied.length === 0 ? message : { ...message, labels: nextLabels };
    }

    for (const label of requestedLabels) {
      const id = toLabelId(label);
      if (existingLabelIds.has(id)) {
        applied.push(label);
      } else {
        skipped.push(label);
      }
    }
    changes.push({ id: message.id, subject: message.subject, applied, skipped });
    return applied.length === 0
      ? message
      : {
          ...message,
          labels: message.labels.filter((l) => !applied.some((a) => toLabelId(a) === toLabelId(l))),
        };
  });

  const affectedCount = changes.filter((change) => change.applied.length > 0).length;
  const totalApplied = changes.reduce((sum, change) => sum + change.applied.length, 0);
  const totalSkipped = changes.reduce((sum, change) => sum + change.skipped.length, 0);

  return {
    messages: nextMessages,
    operation,
    requestedLabels,
    changes,
    summary: {
      operation,
      selectedCount: changes.length,
      affectedCount,
      totalApplied,
      totalSkipped,
    },
  };
}

export function summarizeBulkLabelEdit(result: BulkLabelEditResult): string {
  const { operation, summary } = result;

  if (summary.totalApplied === 0) {
    const reason = operation === "add" ? "all were duplicates" : "none were present";
    return `No changes - ${reason} (${summary.totalSkipped} skipped).`;
  }

  const verb = operation === "add" ? "Added" : "Removed";
  const labelWord = summary.totalApplied === 1 ? "label" : "labels";
  const messageWord = summary.affectedCount === 1 ? "message" : "messages";
  const base = `${verb} ${summary.totalApplied} ${labelWord} across ${summary.affectedCount} ${messageWord}`;

  if (summary.totalSkipped === 0) {
    return `${base}.`;
  }

  const skipReason = operation === "add" ? "skipped as duplicates" : "skipped (not present)";
  return `${base} (${summary.totalSkipped} ${skipReason}).`;
}
