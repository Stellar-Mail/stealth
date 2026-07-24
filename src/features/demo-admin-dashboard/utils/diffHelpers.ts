import type { DemoDataset, DemoMessage, DemoSender } from "../types/dataset";
import type { DatasetDiff, FieldDiff, ItemDiff, DiffType } from "../types/diff";

/**
 * Compares two objects and returns a list of field differences.
 * Only compares top-level fields. For nested objects, it does a shallow comparison
 * or string representation check to keep the visual diff simple.
 */
export function getFieldDiffs<T extends Record<string, any>>(oldItem: T, newItem: T): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const allKeys = Array.from(new Set([...Object.keys(oldItem), ...Object.keys(newItem)]));

  for (const key of allKeys) {
    const oldValue = oldItem[key];
    const newValue = newItem[key];

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      let type: DiffType = "changed";
      if (oldValue === undefined) type = "added";
      else if (newValue === undefined) type = "removed";

      diffs.push({
        fieldName: key,
        oldValue,
        newValue,
        type,
      });
    }
  }

  return diffs;
}

/**
 * Compares two lists of items (messages or senders) by their unique ID.
 */
export function compareItemList<T extends { id?: string; address?: string }>(
  oldList: T[] = [],
  newList: T[] = [],
  idField: keyof T = "id" as keyof T,
): ItemDiff[] {
  const diffs: ItemDiff[] = [];
  const oldMap = new Map(oldList.map((item) => [item[idField] as string, item]));
  const newMap = new Map(newList.map((item) => [item[idField] as string, item]));

  const allIds = Array.from(new Set([...oldMap.keys(), ...newMap.keys()]));

  for (const id of allIds) {
    const oldItem = oldMap.get(id);
    const newItem = newMap.get(id);

    if (!oldItem && newItem) {
      diffs.push({
        id,
        type: "added",
        fields: getFieldDiffs({} as T, newItem),
      });
    } else if (oldItem && !newItem) {
      diffs.push({
        id,
        type: "removed",
        fields: getFieldDiffs(oldItem, {} as T),
      });
    } else if (oldItem && newItem) {
      const fieldDiffs = getFieldDiffs(oldItem, newItem);
      if (fieldDiffs.length > 0) {
        diffs.push({
          id,
          type: "changed",
          fields: fieldDiffs,
        });
      }
    }
  }

  return diffs;
}

/**
 * Generates a full dataset diff between the original fixture and current draft.
 */
export function calculateDatasetDiff(original: DemoDataset, current: DemoDataset): DatasetDiff {
  const messageDiffs = compareItemList(original.messages, current.messages);
  const senderDiffs = compareItemList(
    original.senders || [],
    current.senders || [],
    "address" as any,
  );

  const summary = {
    added:
      messageDiffs.filter((d) => d.type === "added").length +
      senderDiffs.filter((d) => d.type === "added").length,
    removed:
      messageDiffs.filter((d) => d.type === "removed").length +
      senderDiffs.filter((d) => d.type === "removed").length,
    changed:
      messageDiffs.filter((d) => d.type === "changed").length +
      senderDiffs.filter((d) => d.type === "changed").length,
  };

  return {
    messages: messageDiffs,
    senders: senderDiffs,
    summary,
  };
}
