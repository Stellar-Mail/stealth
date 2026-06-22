export { NoteService } from "./service";
export { NoteNotFoundError, ValidationError } from "./errors";
export type { NoteError } from "./errors";
export type {
  Note,
  NoteId,
  ContactId,
  AuthorId,
  CreateNoteInput,
  UpdateNoteInput,
  ServiceConfig,
} from "./types";
export { validateCreateNote, validateUpdateNote } from "./validation";
