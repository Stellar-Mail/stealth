export class ValidationError extends Error {
  constructor(public readonly fields: Array<{ field: string; message: string }>) {
    super("Validation failed");
    this.name = "ValidationError";
  }
}

export class NoteNotFoundError extends Error {
  constructor(public readonly noteId: string) {
    super(`Note not found: ${noteId}`);
    this.name = "NoteNotFoundError";
  }
}

export type NoteError = ValidationError | NoteNotFoundError;
