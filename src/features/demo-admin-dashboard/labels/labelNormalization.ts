import type { DemoLabel, LabeledDemoMessage, LabelUsage } from "./types";

/**
 * Normalize a label's display name: trim the ends and collapse any run of
 * internal whitespace down to a single space. Returns an empty string when the
 * input is only whitespace.
 */
export function normalizeLabelName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Derive a stable, case-insensitive id from a label name. Lowercases the
 * normalized name and replaces every run of non-alphanumeric characters with a
 * single hyphen, with no leading or trailing hyphens.
 */
export function toLabelId(name: string): string {
  return normalizeLabelName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build a label from a raw name. Returns null when the name is blank or has no
 * usable characters, so callers can reject empty input.
 */
export function createLabel(name: string, color?: string): DemoLabel | null {
  const normalized = normalizeLabelName(name);
  const id = toLabelId(normalized);
  if (!normalized || !id) return null;
  return color ? { id, name: normalized, color } : { id, name: normalized };
}

/**
 * Add a label to the list unless one with the same id already exists. Returns
 * the original list unchanged when the name is invalid or already present.
 */
export function addLabel(labels: DemoLabel[], name: string, color?: string): DemoLabel[] {
  const label = createLabel(name, color);
  if (!label || labels.some((existing) => existing.id === label.id)) return labels;
  return [...labels, label];
}

/** Remove a label and strip its id from every message. */
export function removeLabel(
  labels: DemoLabel[],
  messages: LabeledDemoMessage[],
  id: string,
): { labels: DemoLabel[]; messages: LabeledDemoMessage[] } {
  return {
    labels: labels.filter((label) => label.id !== id),
    messages: messages.map((message) =>
      message.labelIds.includes(id)
        ? { ...message, labelIds: message.labelIds.filter((labelId) => labelId !== id) }
        : message,
    ),
  };
}

/** Count how many demo messages use each label. */
export function countLabelUsage(labels: DemoLabel[], messages: LabeledDemoMessage[]): LabelUsage[] {
  const counts = new Map<string, number>();
  for (const message of messages) {
    for (const labelId of message.labelIds) {
      counts.set(labelId, (counts.get(labelId) ?? 0) + 1);
    }
  }
  return labels
    .map((label) => ({ label, count: counts.get(label.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.label.name.localeCompare(b.label.name));
}

/** Labels that no message uses; candidates for cleanup. */
export function unusedLabels(labels: DemoLabel[], messages: LabeledDemoMessage[]): DemoLabel[] {
  return countLabelUsage(labels, messages)
    .filter((usage) => usage.count === 0)
    .map((usage) => usage.label);
}
