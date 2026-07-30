import { OpenEnvelopeError } from "./open-envelope";
import type { EnvelopePayload } from "./envelope";

export interface MigratedEnvelope {
  /** The normalized internal model for app consumption */
  model: EnvelopePayload;
  /** The exact original parsed object preserved for signature verification */
  original: unknown;
}

/**
 * Migration boundary that preserves original authenticated bytes while producing
 * a normalized internal model (v1).
 */
export function migrateEnvelope(payload: unknown): MigratedEnvelope {
  if (!payload || typeof payload !== "object") {
    throw new OpenEnvelopeError("payload is missing", "crypto_validation_error");
  }

  const p = payload as Record<string, unknown>;

  if (p.version === "v1") {
    return {
      model: decodeV1(p),
      original: payload,
    };
  }

  if (p.version === undefined || p.version === "v0") {
    return {
      model: decodeLegacyV0(p),
      original: payload,
    };
  }

  throw new OpenEnvelopeError(
    `unsupported envelope version: ${String(p.version)}`,
    "crypto_version_error",
  );
}

function decodeV1(p: Record<string, unknown>): EnvelopePayload {
  // Pass through structure, openEnvelope's strict validation will catch any issues.
  return p as unknown as EnvelopePayload;
}

function decodeLegacyV0(p: Record<string, unknown>): EnvelopePayload {
  // Legacy shapes might lack attachments or explicitly use v0
  return {
    version: "v1",
    sender: String(p.sender || ""),
    recipient: String(p.recipient || ""),
    timestamp: String(p.timestamp || ""),
    encryption_metadata: p.encryption_metadata as any,
    content_commitment: String(p.content_commitment || ""),
    attachments: Array.isArray(p.attachments) ? p.attachments : [],
  };
}
