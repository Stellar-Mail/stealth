/**
 * Deterministically serializes a JSON-compatible value with sorted object keys.
 *
 * Rules:
 * - Object keys are sorted lexicographically at every level.
 * - Primitive types (string, number, boolean, null) match standard JSON formatting.
 * - Undefined object values, functions, and symbols are omitted.
 * - Undefined array items are serialized as `null`.
 */
export function canonicalJson(val: unknown): string {
  if (val === null || val === undefined) {
    return "null";
  }

  if (typeof val === "boolean" || typeof val === "number" || typeof val === "string") {
    return JSON.stringify(val);
  }

  if (Array.isArray(val)) {
    const items = val.map((item) =>
      item === undefined || typeof item === "function" || typeof item === "symbol"
        ? "null"
        : canonicalJson(item),
    );
    return `[${items.join(",")}]`;
  }

  if (typeof val === "object") {
    const keys = Object.keys(val).sort();
    const entries: string[] = [];
    for (const key of keys) {
      const value = (val as Record<string, unknown>)[key];
      if (value !== undefined && typeof value !== "function" && typeof value !== "symbol") {
        entries.push(`${JSON.stringify(key)}:${canonicalJson(value)}`);
      }
    }
    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(val);
}
