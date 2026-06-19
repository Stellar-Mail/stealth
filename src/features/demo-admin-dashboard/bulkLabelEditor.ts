export type BulkLabelOperation = "add" | "remove";

export interface DraftLabelMessage {
  id: string;
  subject: string;
  labels: string[];
}

export interface BulkLabelChange {
  id: string;
  subject: string;
  applied: string[];
  skipped: string[];
}

export interface BulkLabelSummary {
  operation: BulkLabelOperation;
  selectedCount: number;
  affectedCount: number;
  totalApplied: number;
  totalSkipped: number;
}

export interface BulkLabelEditResult {
  messages: DraftLabelMessage[];
  operation: BulkLabelOperation;
  requestedLabels: string[];
  changes: BulkLabelChange[];
  summary: BulkLabelSummary;
}

export function normalizeDraftLabel(label: string): string {
  return label.trim().toLowerCase();
}

export function normalizeDraftLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of labels) {
    const label = normalizeDraftLabel(raw);
    if (label.length === 0 || seen.has(label)) {
      continue;
    }
    seen.add(label);
    result.push(label);
  }

  return result;
}

export function parseDraftLabelInput(input: string): string[] {
  return normalizeDraftLabels(input.split(/[\s,]+/));
}

export function applyBulkLabelEdit(
  messages: DraftLabelMessage[],
  selectedIds: string[],
  labels: string[],
  operation: BulkLabelOperation,
): BulkLabelEditResult {
  const selected = new Set(selectedIds);
  const requestedLabels = normalizeDraftLabels(labels);
  const changes: BulkLabelChange[] = [];

  const nextMessages = messages.map((message) => {
    if (!selected.has(message.id)) {
      return message;
    }

    const existingLabels = normalizeDraftLabels(message.labels);
    const existing = new Set(existingLabels);
    const applied: string[] = [];
    const skipped: string[] = [];

    if (operation === "add") {
      const nextLabels = [...existingLabels];
      for (const label of requestedLabels) {
        if (existing.has(label)) {
          skipped.push(label);
        } else {
          existing.add(label);
          nextLabels.push(label);
          applied.push(label);
        }
      }
      changes.push({ id: message.id, subject: message.subject, applied, skipped });
      return applied.length === 0 ? message : { ...message, labels: nextLabels };
    }

    const remove = new Set(requestedLabels);
    for (const label of requestedLabels) {
      if (existing.has(label)) {
        applied.push(label);
      } else {
        skipped.push(label);
      }
    }
    changes.push({ id: message.id, subject: message.subject, applied, skipped });
    return applied.length === 0
      ? message
      : { ...message, labels: existingLabels.filter((label) => !remove.has(label)) };
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
    const reason = operation === "add" ? "all labels were duplicates" : "no labels were present";
    return `No changes - ${reason} (${summary.totalSkipped} skipped).`;
  }

  const verb = operation === "add" ? "Added" : "Removed";
  const labelWord = summary.totalApplied === 1 ? "label" : "labels";
  const messageWord = summary.affectedCount === 1 ? "message" : "messages";
  const base = `${verb} ${summary.totalApplied} ${labelWord} across ${summary.affectedCount} ${messageWord}`;

  if (summary.totalSkipped === 0) {
    return `${base}.`;
  }

  const skipped = operation === "add" ? "skipped as duplicates" : "skipped as missing";
  return `${base} (${summary.totalSkipped} ${skipped}).`;
}
