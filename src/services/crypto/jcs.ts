/**
 * JSON Canonicalization Scheme (RFC 8785)
 *
 * Provides a deterministic serialization for JSON.
 * Unsupported values (NaN, Infinity, BigInt, undefined, symbol, function) explicitly throw
 * to avoid silent coercion or stripping during signature generation.
 */

export function canonicalize(value: unknown): string {
  // Primitives and exact matches
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    // JSON.stringify handles strings exactly according to RFC 8785:
    // It escapes ", \, \b, \f, \n, \r, \t, and U+0000 through U+001F (with lowercase hex).
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Cannot canonicalize non-finite number: ${value}`);
    }
    // -0 is correctly formatted as "0" by JSON.stringify
    // Large/small numbers use the exact ES6 ToString algorithm matching RFC 8785.
    if (Object.is(value, -0)) {
      return "0";
    }
    return JSON.stringify(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  // Handle explicitly unsupported primitives
  if (
    typeof value === "bigint" ||
    typeof value === "undefined" ||
    typeof value === "symbol" ||
    typeof value === "function"
  ) {
    throw new Error(`Cannot canonicalize unsupported value type: ${typeof value}`);
  }

  // For objects, check if they have a toJSON method
  if (typeof value === "object") {
    // If it has a toJSON method, resolve it before canonicalizing
    if ("toJSON" in value && typeof (value as any).toJSON === "function") {
      return canonicalize((value as any).toJSON());
    }

    if (Array.isArray(value)) {
      let out = "[";
      for (let i = 0; i < value.length; i++) {
        if (i > 0) out += ",";
        // To strictly match "fail explicitly" on undefined/symbol/function inside arrays
        const item = value[i];
        if (item === undefined || typeof item === "symbol" || typeof item === "function") {
          throw new Error(`Cannot canonicalize unsupported value type in array: ${typeof item}`);
        }
        out += canonicalize(item);
      }
      out += "]";
      return out;
    }

    // Standard Object
    let out = "{";
    const keys = Object.keys(value).sort();
    let first = true;
    for (const key of keys) {
      const val = (value as Record<string, unknown>)[key];
      // Skip undefined, symbol, function, or throw?
      // Criteria: "Unsupported values such as NaN, Infinity, BigInt, and undefined fail explicitly."
      // So we throw!
      if (val === undefined || typeof val === "symbol" || typeof val === "function") {
        throw new Error(
          `Cannot canonicalize unsupported value type for key "${key}": ${typeof val}`,
        );
      }

      if (!first) out += ",";
      out += JSON.stringify(key) + ":" + canonicalize(val);
      first = false;
    }
    out += "}";
    return out;
  }

  throw new Error(`Cannot canonicalize unknown type: ${typeof value}`);
}
