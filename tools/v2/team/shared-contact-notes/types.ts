export type NoteId = string;
export type ContactId = string;
export type AuthorId = string;

export type Note = {
  id: NoteId;
  contactId: ContactId;
  content: string;
  authorId: AuthorId;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type CreateNoteInput = {
  contactId: ContactId;
  content: string;
  authorId: AuthorId;
};

export type UpdateNoteInput = {
  content?: string;
};

export type ServiceConfig = {
  delayMs: number;
  /** Max notes returned per getByContact call. Prevents unbounded reads on large datasets. */
  maxNotesPerContact: number;
};

// Hard limits — keep these conservative. Content is user-facing prose, not
// arbitrary binary. IDs are internal references and should never be long.
export const LIMITS = {
  CONTENT_MAX: 10_000,
  ID_MAX: 256,
} as const;
