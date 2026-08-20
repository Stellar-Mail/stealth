/**
 * Mail Quarantine System.
 *
 * Isolates malformed, tampered, invalidly signed, or undecryptable envelopes
 * so they cannot execute scripts or display attacker-controlled data to the recipient.
 */

export type QuarantineReasonCode =
  | "schema_error"
  | "version_error"
  | "integrity_error"
  | "decryption_error"
  | "validation_error"
  | "timestamp_error"
  | "signature_error"
  | "recipient_mismatch";

export interface QuarantinedMailRecord {
  diagnosticId: string;
  quarantinedAt: string;
  reasonCode: QuarantineReasonCode;
  userHeadline: string;
  userDetail: string;
  sender?: string;
  recipient?: string;
  rawHash?: string;
}

function generateDiagnosticId(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `quar-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export function createQuarantineRecord(
  error: unknown,
  sender?: string,
  recipient?: string,
): QuarantinedMailRecord {
  const timestamp = new Date().toISOString();
  const seed = `${timestamp}:${sender ?? "unknown"}:${recipient ?? "unknown"}:${String(error)}`;
  const diagnosticId = generateDiagnosticId(seed);

  let reasonCode: QuarantineReasonCode = "validation_error";
  let userHeadline = "Quarantined Envelope";
  let userDetail = "The message failed security and integrity checks and was isolated.";

  if (error !== null && typeof error === "object") {
    const code = (error as { code?: unknown }).code;
    const msg = (error as { message?: string }).message ?? "";

    if (code === "crypto_version_error" || msg.includes("version")) {
      reasonCode = "version_error";
      userHeadline = "Unsupported Protocol Version";
      userDetail = "The envelope uses an unsupported version that cannot be safely processed.";
    } else if (
      code === "crypto_integrity_error" ||
      msg.includes("signature") ||
      msg.includes("mac") ||
      msg.includes("auth tag") ||
      msg.includes("commitment")
    ) {
      if (msg.includes("signature")) {
        reasonCode = "signature_error";
        userHeadline = "Sender Signature Verification Failed";
        userDetail =
          "The digital signature attached to this envelope does not match the sender key.";
      } else {
        reasonCode = "integrity_error";
        userHeadline = "Integrity Check Failed";
        userDetail =
          "The content commitment or MAC tag failed verification. Possible tampering detected.";
      }
    } else if (
      code === "crypto_decryption_error" ||
      msg.includes("decryption") ||
      msg.includes("key")
    ) {
      reasonCode = "decryption_error";
      userHeadline = "Decryption Key Unavailable";
      userDetail = "The payload could not be decrypted with your recipient key.";
    } else if (msg.includes("recipient binding")) {
      reasonCode = "recipient_mismatch";
      userHeadline = "Recipient Binding Mismatch";
      userDetail = "This envelope was addressed to a different recipient key binding.";
    } else if (msg.includes("timestamp")) {
      reasonCode = "timestamp_error";
      userHeadline = "Timestamp Out of Bounds";
      userDetail = "The envelope timestamp is stale or far in the future.";
    } else if (code === "crypto_validation_error" || msg.includes("schema")) {
      reasonCode = "schema_error";
      userHeadline = "Envelope Schema Error";
      userDetail = "The envelope structural format or field bounds are invalid.";
    }
  }

  return {
    diagnosticId,
    quarantinedAt: timestamp,
    reasonCode,
    userHeadline,
    userDetail,
    sender,
    recipient,
  };
}
