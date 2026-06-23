import type { CreateNoteInput, UpdateNoteInput } from "./types";
import { LIMITS } from "./types";

type FieldError = { field: string; message: string };

function checkId(value: unknown, field: string): FieldError | null {
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    return { field, message: `${field} is required` };
  }
  if (value.length > LIMITS.ID_MAX) {
    return { field, message: `${field} must be ${LIMITS.ID_MAX} characters or fewer` };
  }
  return null;
}

function checkContent(value: unknown, field = "content"): FieldError | null {
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    return { field, message: `${field} is required` };
  }
  if (value.length > LIMITS.CONTENT_MAX) {
    return { field, message: `${field} must be ${LIMITS.CONTENT_MAX} characters or fewer` };
  }
  return null;
}

export function validateCreateNote(input: CreateNoteInput): FieldError[] {
  const errors: FieldError[] = [];
  const contactErr = checkId(input.contactId, "contactId");
  if (contactErr) errors.push(contactErr);
  const contentErr = checkContent(input.content);
  if (contentErr) errors.push(contentErr);
  const authorErr = checkId(input.authorId, "authorId");
  if (authorErr) errors.push(authorErr);
  return errors;
}

export function validateUpdateNote(input: UpdateNoteInput): FieldError[] {
  if (input.content === undefined) return [];
  const err = checkContent(input.content);
  return err ? [err] : [];
}

/** Validate a bare ID used in get/update/delete/archive calls. */
export function validateId(id: unknown, field = "id"): FieldError | null {
  return checkId(id, field);
}
