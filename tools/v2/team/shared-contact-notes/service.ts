import type {
  Note,
  NoteId,
  ContactId,
  CreateNoteInput,
  UpdateNoteInput,
  ServiceConfig,
} from "./types";
import { NoteNotFoundError, ValidationError } from "./errors";
import { validateCreateNote, validateUpdateNote } from "./validation";

export class NoteService {
  private notes: Map<NoteId, Note>;
  private config: ServiceConfig;

  constructor(seedNotes?: Note[], config?: Partial<ServiceConfig>) {
    this.notes = new Map();
    this.config = { delayMs: 0, ...config };
    if (seedNotes) {
      for (const note of seedNotes) {
        this.notes.set(note.id, { ...note });
      }
    }
  }

  private async delay(): Promise<void> {
    if (this.config.delayMs > 0) {
      return new Promise((resolve) => setTimeout(resolve, this.config.delayMs));
    }
  }

  async create(input: CreateNoteInput): Promise<Note> {
    const validationErrors = validateCreateNote(input);
    if (validationErrors.length > 0) {
      throw new ValidationError(validationErrors);
    }

    await this.delay();

    const now = new Date().toISOString();
    const note: Note = {
      id: crypto.randomUUID(),
      contactId: input.contactId.trim(),
      content: input.content.trim(),
      authorId: input.authorId.trim(),
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };

    this.notes.set(note.id, note);
    return { ...note };
  }

  async getByContact(contactId: ContactId): Promise<Note[]> {
    if (!contactId || typeof contactId !== "string" || contactId.trim().length === 0) {
      throw new ValidationError([{ field: "contactId", message: "contactId is required" }]);
    }

    await this.delay();

    return Array.from(this.notes.values())
      .filter((note) => note.contactId === contactId.trim())
      .map((note) => ({ ...note }));
  }

  async getById(id: NoteId): Promise<Note> {
    await this.delay();

    const note = this.notes.get(id);
    if (!note) {
      throw new NoteNotFoundError(id);
    }

    return { ...note };
  }

  async update(id: NoteId, input: UpdateNoteInput): Promise<Note> {
    if (!id || typeof id !== "string" || id.trim().length === 0) {
      throw new ValidationError([{ field: "id", message: "id is required" }]);
    }

    const validationErrors = validateUpdateNote(input);
    if (validationErrors.length > 0) {
      throw new ValidationError(validationErrors);
    }

    await this.delay();

    const existing = this.notes.get(id);
    if (!existing) {
      throw new NoteNotFoundError(id);
    }

    const updated: Note = {
      ...existing,
      ...(input.content !== undefined ? { content: input.content.trim() } : {}),
      updatedAt: new Date().toISOString(),
    };

    this.notes.set(id, updated);
    return { ...updated };
  }

  async delete(id: NoteId): Promise<void> {
    if (!id || typeof id !== "string" || id.trim().length === 0) {
      throw new ValidationError([{ field: "id", message: "id is required" }]);
    }

    await this.delay();

    if (!this.notes.has(id)) {
      throw new NoteNotFoundError(id);
    }

    this.notes.delete(id);
  }

  async archive(id: NoteId): Promise<Note> {
    if (!id || typeof id !== "string" || id.trim().length === 0) {
      throw new ValidationError([{ field: "id", message: "id is required" }]);
    }

    await this.delay();

    const existing = this.notes.get(id);
    if (!existing) {
      throw new NoteNotFoundError(id);
    }

    const archived: Note = {
      ...existing,
      archivedAt: existing.archivedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.notes.set(id, archived);
    return { ...archived };
  }
}
