import type {
  PrivateNoteAttachmentInput,
  PrivateNoteAttachmentOptions,
  PrivateNoteAttachmentOutput,
  PrivateNoteImportance,
  PrivateNoteVisibility,
  SafePrivateNoteResult,
} from "../types/privateNoteOnEmail";
import {
  checkPrivateNoteInputLimits,
  sanitizePrivateNoteInput,
  validatePrivateNoteInput,
  validatePrivateNoteOptions,
} from "./guards";

function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function extractAutoKeywords(text: string): string[] {
  const commonKeywords = [
    "urgent",
    "followup",
    "follow-up",
    "action",
    "todo",
    "meeting",
    "deadline",
    "review",
    "approval",
    "invoice",
    "payment",
    "confidential",
    "vip",
  ];
  const lowerText = text.toLowerCase();
  const matched = commonKeywords.filter((kw) => lowerText.includes(kw));
  return matched.map((kw) => (kw === "follow-up" ? "followup" : kw));
}

export function attachPrivateNote(
  input: PrivateNoteAttachmentInput,
  options?: PrivateNoteAttachmentOptions,
): PrivateNoteAttachmentOutput {
  const stripHtml = options?.stripHtml ?? true;
  const sanitizedInput = sanitizePrivateNoteInput(input, stripHtml);

  const importance: PrivateNoteImportance = sanitizedInput.importance ?? "medium";
  const visibility: PrivateNoteVisibility = sanitizedInput.visibility ?? "private";

  let finalTags: string[] = sanitizedInput.tags ? [...sanitizedInput.tags] : [];

  let autoTagged = false;
  if (options?.autoTagKeywords !== false) {
    const autoKeywords = extractAutoKeywords(sanitizedInput.noteText);
    if (autoKeywords.length > 0) {
      const tagSet = new Set([...finalTags, ...autoKeywords]);
      finalTags = Array.from(tagSet);
      autoTagged = true;
    }
  }

  // Deduplicate and trim tags
  finalTags = Array.from(new Set(finalTags.map((t) => t.trim().toLowerCase()))).filter(
    (t) => t.length > 0,
  );

  const words = sanitizedInput.noteText.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;
  const characterCount = sanitizedInput.noteText.length;

  const contentHash = generateHash(`${sanitizedInput.emailId}:${sanitizedInput.noteText}`);
  const noteId = `note_${sanitizedInput.emailId}_${contentHash}`;

  const nowIso = new Date().toISOString();
  const reminderAt = sanitizedInput.reminderAt
    ? new Date(sanitizedInput.reminderAt).toISOString()
    : null;

  const subjectSnippet = sanitizedInput.emailSubject
    ? sanitizedInput.emailSubject.length > 60
      ? `${sanitizedInput.emailSubject.slice(0, 57)}...`
      : sanitizedInput.emailSubject
    : null;

  return {
    requestId: sanitizedInput.requestId,
    emailId: sanitizedInput.emailId,
    noteId,
    cleanNoteText: sanitizedInput.noteText,
    importance,
    visibility,
    tags: finalTags,
    characterCount,
    wordCount,
    createdAt: nowIso,
    reminderAt,
    metadata: {
      emailSubjectSnippet: subjectSnippet,
      emailSender: sanitizedInput.emailSender ?? null,
      autoTagged,
    },
  };
}

export function safeAttachPrivateNote(input: unknown, options?: unknown): SafePrivateNoteResult {
  const inputValidation = validatePrivateNoteInput(input);
  if (!inputValidation.valid) {
    return {
      status: "error",
      code: "invalid-input",
      message: "Private note input payload validation failed",
      issues: inputValidation.issues,
    };
  }

  const optionsValidation = validatePrivateNoteOptions(options);
  if (!optionsValidation.valid) {
    return {
      status: "error",
      code: "invalid-options",
      message: "Private note options validation failed",
      issues: optionsValidation.issues,
    };
  }

  const typedInput = input as PrivateNoteAttachmentInput;
  const typedOptions = options as PrivateNoteAttachmentOptions | undefined;

  const stripHtml = typedOptions?.stripHtml ?? true;
  const sanitizedInput = sanitizePrivateNoteInput(typedInput, stripHtml);

  const limitsCheck = checkPrivateNoteInputLimits(sanitizedInput, typedOptions);
  if (!limitsCheck.ok) {
    return {
      status: "error",
      code: limitsCheck.code!,
      message: limitsCheck.message!,
      issues: limitsCheck.issues ?? [],
    };
  }

  try {
    const result = attachPrivateNote(sanitizedInput, typedOptions);
    return {
      status: "ok",
      result,
    };
  } catch (err) {
    return {
      status: "error",
      code: "invalid-input",
      message: err instanceof Error ? err.message : "Unexpected error processing private note",
      issues: [{ field: "input", message: "Unexpected failure during execution" }],
    };
  }
}
