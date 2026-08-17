export type CollisionGuardCode =
  | "ATTACHMENTS_SIZE_LIMIT"
  | "ATTACHMENTS_TRUNCATED"
  | "BODY_TRUNCATED"
  | "CANDIDATE_MALFORMED"
  | "CANDIDATE_MISSING_ID"
  | "HISTORY_TRUNCATED"
  | "INPUT_NOT_ARRAY";

export interface CollisionGuardNotice {
  code: CollisionGuardCode;
  message: string;
}

export interface CollisionGuardOptions {
  maxItems?: number;
  maxSubjectChars?: number;
  maxBodyChars?: number;
  maxAttachmentCount?: number;
  maxAttachmentBytes?: number;
}

export interface PreparedCollisionCandidate {
  id: string;
  threadId: string;
  recipient: string;
  subject: string;
  body: string;
  attachmentCount: number;
  totalAttachmentBytes: number;
  fingerprint: string;
}

export interface CollisionGuardResult {
  ok: boolean;
  candidates: PreparedCollisionCandidate[];
  errors: CollisionGuardNotice[];
  warnings: CollisionGuardNotice[];
  inspectedCount: number;
  skippedCount: number;
  truncated: boolean;
}

const DEFAULT_OPTIONS: Required<CollisionGuardOptions> = {
  maxItems: 250,
  maxSubjectChars: 240,
  maxBodyChars: 8_000,
  maxAttachmentCount: 25,
  maxAttachmentBytes: 50 * 1024 * 1024,
};

const HTML_TAGS = /<[^>]*>/g;
const WHITESPACE = /\s+/g;

function clampPositiveInteger(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function coerceText(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return "";
}

function stripControlChars(value: string) {
  let output = "";
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if ((code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31)) {
      continue;
    }
    if (code === 127) continue;
    output += value[i];
  }
  return output;
}

function sanitizeText(value: unknown, maxChars: number) {
  const normalized = stripControlChars(coerceText(value)).replace(HTML_TAGS, " ");
  const collapsed = normalized.replace(WHITESPACE, " ").trim();
  const truncated = collapsed.length > maxChars;
  return {
    value: truncated ? collapsed.slice(0, maxChars).trimEnd() : collapsed,
    truncated,
  };
}

function normalizeForFingerprint(value: string) {
  return value.toLowerCase().replace(WHITESPACE, " ").trim();
}

function fingerprint(parts: string[]) {
  const input = parts.join("\u001f");
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return `collision:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function collectAttachmentStats(
  rawAttachments: unknown,
  candidateId: string,
  options: Required<CollisionGuardOptions>,
  warnings: CollisionGuardNotice[],
) {
  if (!Array.isArray(rawAttachments)) {
    return { attachmentCount: 0, totalAttachmentBytes: 0 };
  }

  if (rawAttachments.length > options.maxAttachmentCount) {
    warnings.push({
      code: "ATTACHMENTS_TRUNCATED",
      message: `Candidate ${candidateId} attachments exceeded ${options.maxAttachmentCount} items and were truncated.`,
    });
  }

  let attachmentCount = 0;
  let totalAttachmentBytes = 0;

  for (const rawAttachment of rawAttachments.slice(0, options.maxAttachmentCount)) {
    const attachment = toRecord(rawAttachment);
    if (!attachment) continue;

    const sizeBytes =
      typeof attachment.sizeBytes === "number" && Number.isFinite(attachment.sizeBytes)
        ? Math.max(0, Math.floor(attachment.sizeBytes))
        : 0;

    if (totalAttachmentBytes + sizeBytes > options.maxAttachmentBytes) {
      warnings.push({
        code: "ATTACHMENTS_SIZE_LIMIT",
        message: `Candidate ${candidateId} attachments exceeded ${options.maxAttachmentBytes} total bytes and were capped.`,
      });
      break;
    }

    attachmentCount += 1;
    totalAttachmentBytes += sizeBytes;
  }

  return { attachmentCount, totalAttachmentBytes };
}

export function prepareCollisionInput(
  payload: unknown,
  providedOptions: CollisionGuardOptions = {},
): CollisionGuardResult {
  const options: Required<CollisionGuardOptions> = {
    maxItems: clampPositiveInteger(providedOptions.maxItems, DEFAULT_OPTIONS.maxItems),
    maxSubjectChars: clampPositiveInteger(
      providedOptions.maxSubjectChars,
      DEFAULT_OPTIONS.maxSubjectChars,
    ),
    maxBodyChars: clampPositiveInteger(providedOptions.maxBodyChars, DEFAULT_OPTIONS.maxBodyChars),
    maxAttachmentCount: clampPositiveInteger(
      providedOptions.maxAttachmentCount,
      DEFAULT_OPTIONS.maxAttachmentCount,
    ),
    maxAttachmentBytes: clampPositiveInteger(
      providedOptions.maxAttachmentBytes,
      DEFAULT_OPTIONS.maxAttachmentBytes,
    ),
  };

  if (!Array.isArray(payload)) {
    return {
      ok: false,
      candidates: [],
      errors: [
        {
          code: "INPUT_NOT_ARRAY",
          message: "Collision detection expects an array of candidate responses.",
        },
      ],
      warnings: [],
      inspectedCount: 0,
      skippedCount: 0,
      truncated: false,
    };
  }

  const warnings: CollisionGuardNotice[] = [];
  const candidates: PreparedCollisionCandidate[] = [];
  const limitedPayload = payload.slice(0, options.maxItems);
  const skippedCount = Math.max(0, payload.length - limitedPayload.length);

  if (skippedCount > 0) {
    warnings.push({
      code: "HISTORY_TRUNCATED",
      message: `Only the first ${limitedPayload.length} candidates were inspected; ${skippedCount} were skipped.`,
    });
  }

  for (const rawCandidate of limitedPayload) {
    const candidate = toRecord(rawCandidate);
    if (!candidate) {
      warnings.push({
        code: "CANDIDATE_MALFORMED",
        message: "A collision candidate was ignored because it was not an object.",
      });
      continue;
    }

    const id = sanitizeText(candidate.id, 120).value;
    if (!id) {
      warnings.push({
        code: "CANDIDATE_MISSING_ID",
        message: "A collision candidate was ignored because it has no stable id.",
      });
      continue;
    }

    const threadId = sanitizeText(candidate.threadId, 160).value;
    const recipient = sanitizeText(candidate.recipient, 320).value.toLowerCase();
    const subject = sanitizeText(candidate.subject, options.maxSubjectChars).value;
    const body = sanitizeText(candidate.body, options.maxBodyChars);
    const attachmentStats = collectAttachmentStats(candidate.attachments, id, options, warnings);

    if (body.truncated) {
      warnings.push({
        code: "BODY_TRUNCATED",
        message: `Candidate ${id} body exceeded ${options.maxBodyChars} characters and was truncated.`,
      });
    }

    candidates.push({
      id,
      threadId,
      recipient,
      subject,
      body: body.value,
      ...attachmentStats,
      fingerprint: fingerprint([
        normalizeForFingerprint(threadId),
        normalizeForFingerprint(recipient),
        normalizeForFingerprint(subject),
        normalizeForFingerprint(body.value),
      ]),
    });
  }

  return {
    ok: true,
    candidates,
    errors: [],
    warnings,
    inspectedCount: limitedPayload.length,
    skippedCount,
    truncated: skippedCount > 0,
  };
}
