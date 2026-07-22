import { MAX_BODY_WORDS_LIMIT, writeColdEmail } from "./coldEmailWriter";
import type {
  ColdEmailParty,
  ColdEmailWriterInput,
  ColdEmailWriterOptions,
  ColdEmailWriterValidationIssue,
  SafeColdEmailWriterResult,
} from "../types/coldEmailWriter";

export const COLD_EMAIL_INPUT_LIMITS = {
  requestIdChars: 256,
  partyFieldChars: 200,
  contentFieldChars: 2_000,
  proofPoints: 10,
} as const;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const INVISIBLE_CHARACTERS = /[\u200b-\u200d\u2060\ufeff]/g;

export function sanitizeColdEmailText(value: string): string {
  return value
    .normalize("NFC")
    .replace(CONTROL_CHARACTERS, "")
    .replace(INVISIBLE_CHARACTERS, "")
    .trim();
}

function isParty(value: unknown): value is ColdEmailParty {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const party = value as Record<string, unknown>;
  return (
    typeof party.name === "string" &&
    (party.company === undefined || typeof party.company === "string") &&
    (party.role === undefined || typeof party.role === "string")
  );
}

export function validateColdEmailInput(value: unknown): value is ColdEmailWriterInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.requestId === "string" &&
    isParty(input.sender) &&
    isParty(input.recipient) &&
    typeof input.offer === "string" &&
    typeof input.valueProposition === "string" &&
    typeof input.callToAction === "string" &&
    (input.proofPoints === undefined ||
      (Array.isArray(input.proofPoints) &&
        input.proofPoints.every((point) => typeof point === "string"))) &&
    (input.tone === undefined ||
      input.tone === "professional" ||
      input.tone === "friendly" ||
      input.tone === "direct")
  );
}

export function validateColdEmailOptions(value: unknown): value is ColdEmailWriterOptions {
  if (value === undefined) return true;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const options = value as Record<string, unknown>;
  return (
    (options.includeSubject === undefined || typeof options.includeSubject === "boolean") &&
    (options.maxBodyWords === undefined ||
      (typeof options.maxBodyWords === "number" &&
        Number.isInteger(options.maxBodyWords) &&
        options.maxBodyWords >= 1 &&
        options.maxBodyWords <= MAX_BODY_WORDS_LIMIT))
  );
}

export function sanitizeColdEmailInput(input: ColdEmailWriterInput): ColdEmailWriterInput {
  const cleanParty = (party: ColdEmailParty): ColdEmailParty => ({
    name: sanitizeColdEmailText(party.name),
    ...(party.company === undefined ? {} : { company: sanitizeColdEmailText(party.company) }),
    ...(party.role === undefined ? {} : { role: sanitizeColdEmailText(party.role) }),
  });
  return {
    ...input,
    requestId: sanitizeColdEmailText(input.requestId),
    sender: cleanParty(input.sender),
    recipient: cleanParty(input.recipient),
    offer: sanitizeColdEmailText(input.offer),
    valueProposition: sanitizeColdEmailText(input.valueProposition),
    callToAction: sanitizeColdEmailText(input.callToAction),
    ...(input.proofPoints === undefined
      ? {}
      : { proofPoints: input.proofPoints.map(sanitizeColdEmailText) }),
  };
}

export function checkColdEmailInputLimits(
  input: ColdEmailWriterInput,
): ColdEmailWriterValidationIssue[] {
  const issues: ColdEmailWriterValidationIssue[] = [];
  const fields: Array<[string, string, number]> = [
    ["requestId", input.requestId, COLD_EMAIL_INPUT_LIMITS.requestIdChars],
    ["sender.name", input.sender.name, COLD_EMAIL_INPUT_LIMITS.partyFieldChars],
    ["recipient.name", input.recipient.name, COLD_EMAIL_INPUT_LIMITS.partyFieldChars],
    ["offer", input.offer, COLD_EMAIL_INPUT_LIMITS.contentFieldChars],
    ["valueProposition", input.valueProposition, COLD_EMAIL_INPUT_LIMITS.contentFieldChars],
    ["callToAction", input.callToAction, COLD_EMAIL_INPUT_LIMITS.contentFieldChars],
  ];
  for (const [field, value, limit] of fields) {
    if (value.length > limit) {
      issues.push({
        code: "input-too-large",
        field,
        message: `${field} exceeds ${limit} characters`,
      });
    }
  }
  if ((input.proofPoints?.length ?? 0) > COLD_EMAIL_INPUT_LIMITS.proofPoints) {
    issues.push({
      code: "input-too-large",
      field: "proofPoints",
      message: `proofPoints exceeds ${COLD_EMAIL_INPUT_LIMITS.proofPoints} items`,
    });
  }
  return issues;
}

/** Guarded backend entry point. It always returns a result and never throws. */
export function safeWriteColdEmail(input: unknown, options?: unknown): SafeColdEmailWriterResult {
  if (!validateColdEmailInput(input)) {
    return {
      status: "error",
      code: "invalid-input",
      message: "Input does not match the ColdEmailWriterInput contract.",
      issues: [{ code: "invalid-input", message: "Input failed structural validation." }],
    };
  }
  if (!validateColdEmailOptions(options)) {
    return {
      status: "error",
      code: "invalid-options",
      message: `maxBodyWords must be an integer from 1 to ${MAX_BODY_WORDS_LIMIT}.`,
      issues: [{ code: "invalid-options", message: "Options failed structural validation." }],
    };
  }
  const limitIssues = checkColdEmailInputLimits(input);
  if (limitIssues.length > 0) {
    return {
      status: "error",
      code: "input-too-large",
      message: limitIssues.map((issue) => issue.message).join("; "),
      issues: limitIssues,
    };
  }
  const sanitized = sanitizeColdEmailInput(input);
  const required = [
    sanitized.requestId,
    sanitized.sender.name,
    sanitized.recipient.name,
    sanitized.offer,
    sanitized.valueProposition,
    sanitized.callToAction,
  ];
  if (required.some((value) => value.length === 0)) {
    return {
      status: "error",
      code: "empty-content",
      message: "Required text fields must not be empty after sanitization.",
      issues: [{ code: "empty-content", message: "One or more required fields are empty." }],
    };
  }
  return { status: "ok", result: writeColdEmail(sanitized, options) };
}
