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
};
