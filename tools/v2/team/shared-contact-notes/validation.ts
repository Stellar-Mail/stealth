import type { CreateNoteInput, UpdateNoteInput } from "./types";

export function validateCreateNote(
  input: CreateNoteInput,
): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = [];

  if (
    !input.contactId ||
    typeof input.contactId !== "string" ||
    input.contactId.trim().length === 0
  ) {
    errors.push({ field: "contactId", message: "contactId is required" });
  }
  if (!input.content || typeof input.content !== "string" || input.content.trim().length === 0) {
    errors.push({ field: "content", message: "content is required" });
  }
  if (!input.authorId || typeof input.authorId !== "string" || input.authorId.trim().length === 0) {
    errors.push({ field: "authorId", message: "authorId is required" });
  }

  return errors;
}

export function validateUpdateNote(
  input: UpdateNoteInput,
): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = [];

  if (
    input.content !== undefined &&
    (typeof input.content !== "string" || input.content.trim().length === 0)
  ) {
    errors.push({ field: "content", message: "content cannot be empty" });
  }

  return errors;
}
