import { createHash } from "node:crypto";
import { canonicalJson } from "./canonicalJson";

/**
 * Computes a deterministic SHA-256 hash of a request body.
 *
 * Requirements:
 * - Empty or whitespace-only bodies compute the hash of "".
 * - Valid JSON strings or JSON objects are serialized deterministically (sorted keys, no whitespace).
 * - Non-JSON strings or raw content are hashed as UTF-8 bytes.
 */
export function computeBodyHash(body?: unknown): string {
  if (body === null || body === undefined) {
    return createHash("sha256").update("", "utf8").digest("hex");
  }

  let textToHash: string;

  if (typeof body === "string") {
    const trimmed = body.trim();
    if (trimmed === "") {
      textToHash = "";
    } else {
      try {
        const parsed = JSON.parse(body);
        textToHash = canonicalJson(parsed);
      } catch {
        textToHash = body;
      }
    }
  } else if (typeof body === "object") {
    textToHash = canonicalJson(body);
  } else {
    textToHash = String(body);
  }

  return createHash("sha256").update(textToHash, "utf8").digest("hex");
}
