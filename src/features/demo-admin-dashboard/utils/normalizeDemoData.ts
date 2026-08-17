export const KNOWN_FOLDERS = ["inbox", "pending", "requests", "receipts", "spam"] as const;

function normalizeLabel(label: string): string {
  return label.toLowerCase().trim();
}

export function normalizeLabels(labels: string[]): string[] {
  return labels.map(normalizeLabel).filter((l) => l.length > 0);
}

export function deterministicId(prefix: string, name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${prefix}-${slug || "unnamed"}`;
}

export function detectCollisions(items: { id: string }[]): Set<string> {
  const seen = new Map<string, number>();
  const collisions = new Set<string>();
  for (const item of items) {
    const count = (seen.get(item.id) ?? 0) + 1;
    seen.set(item.id, count);
    if (count === 2) collisions.add(item.id);
  }
  return collisions;
}

export function deterministicSnapshotId(
  prefix: string,
  name: string,
  existingIds: Set<string>,
): string {
  const base = deterministicId(prefix, name);
  if (!existingIds.has(base)) return base;
  let counter = 2;
  while (existingIds.has(`${base}-${counter}`)) counter++;
  return `${base}-${counter}`;
}

export function normalizeFolder(folder: string): string {
  const normalized = folder.toLowerCase().trim();
  if ((KNOWN_FOLDERS as readonly string[]).includes(normalized)) {
    return normalized;
  }
  return "inbox";
}

export function normalizeTimestamp(timestamp: string): string {
  if (Number.isNaN(new Date(timestamp).getTime())) {
    return timestamp;
  }
  return timestamp;
}
