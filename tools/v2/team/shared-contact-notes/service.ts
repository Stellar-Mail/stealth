import type {
  Note,
  NoteId,
  ContactId,
  CreateNoteInput,
  UpdateNoteInput,
  ServiceConfig,
} from "./types";
import { NoteNotFoundError, ValidationError } from "./errors";
import { validateCreateNote, validateUpdateNote, validateId } from "./validation";

const DEFAULT_CONFIG: ServiceConfig = {
  delayMs: 0,
  // Performance guard: cap results per contact to avoid unbounded reads when a
  // contact accumulates a large note history. Callers that need pagination can
  // lower this and implement cursor logic on top.
  maxNotesPerContact: 500,
};

export class NoteService {
  private notes: Map<NoteId, Note>;
  private config: ServiceConfig;

  constructor(seedNotes?: Note[], config?: Partial<ServiceConfig>) {
    this.notes = new Map();
    this.config = { ...DEFAULT_CONFIG, ...config };
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
    const errors = validateCreateNote(input);
    if (errors.length > 0) throw new ValidationError(errors);

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
    const idErr = validateId(contactId, "contactId");
    if (idErr) throw new ValidationError([idErr]);

    await this.delay();

    const results: Note[] = [];
    for (const note of this.notes.values()) {
      if (note.contactId === contactId.trim()) {
        results.push({ ...note });
        // Stop early once we hit the cap — avoids iterating the full map on
        // contacts with very large note histories.
        if (results.length >= this.config.maxNotesPerContact) break;
      }
    }
    return results;
  }

  async getById(id: NoteId): Promise<Note> {
    await this.delay();

    const note = this.notes.get(id);
    if (!note) throw new NoteNotFoundError(id);
    return { ...note };
  }

  async update(id: NoteId, input: UpdateNoteInput): Promise<Note> {
    const idErr = validateId(id);
    if (idErr) throw new ValidationError([idErr]);

    const errors = validateUpdateNote(input);
    if (errors.length > 0) throw new ValidationError(errors);

    await this.delay();

    const existing = this.notes.get(id);
    if (!existing) throw new NoteNotFoundError(id);

    const updated: Note = {
      ...existing,
      ...(input.content !== undefined ? { content: input.content.trim() } : {}),
      updatedAt: new Date().toISOString(),
    };

    this.notes.set(id, updated);
    return { ...updated };
  }

  async delete(id: NoteId): Promise<void> {
    const idErr = validateId(id);
    if (idErr) throw new ValidationError([idErr]);

    await this.delay();

    if (!this.notes.has(id)) throw new NoteNotFoundError(id);
    this.notes.delete(id);
  }

  async archive(id: NoteId): Promise<Note> {
    const idErr = validateId(id);
    if (idErr) throw new ValidationError([idErr]);

    await this.delay();

    const existing = this.notes.get(id);
    if (!existing) throw new NoteNotFoundError(id);

    const archived: Note = {
      ...existing,
      archivedAt: existing.archivedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.notes.set(id, archived);
    return { ...archived };
  }
}
