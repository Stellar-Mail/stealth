import type { AdminDemoRecord } from "./types";

/** Trim and lowercase a string for case-insensitive matching. */
export function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Filter rows by a free-text query across the given string fields.
 * An empty or whitespace-only query returns a copy of all rows.
 * Generic so it can be reused by any demo-admin table or picker.
 */
export function filterRows<T>(
  rows: readonly T[],
  query: string,
  fields: readonly (keyof T)[],
): T[] {
  const q = normalize(query);
  if (!q) return [...rows];
  return rows.filter((row) =>
    fields.some((field) => {
      const value = row[field];
      return typeof value === "string" && normalize(value).includes(q);
    }),
  );
}

/** Human-readable count, e.g. "1 result" or "2 results of 8". */
export function resultCountLabel(count: number, total: number): string {
  const noun = count === 1 ? "result" : "results";
  return count === total ? `${count} ${noun}` : `${count} ${noun} of ${total}`;
}

/** Convenience wrapper bound to the admin demo record shape. */
export function searchAdminRecords(
  rows: readonly AdminDemoRecord[],
  query: string,
): AdminDemoRecord[] {
  return filterRows(rows, query, ["name", "address", "role", "status"]);
}
