import { describe, it, expect } from "vitest";
import { NoteService } from "../service";
import { ValidationError, NoteNotFoundError } from "../errors";
import { seedNotes } from "../fixtures/notes";
import type { Note, CreateNoteInput, UpdateNoteInput } from "../types";

function createService(notes?: Note[]): NoteService {
  return new NoteService(notes, { delayMs: 0 });
}

const validCreateInput: CreateNoteInput = {
  contactId: "contact-new",
  content: "Test note content",
  authorId: "user-test",
};

const validUpdateInput: UpdateNoteInput = {
  content: "Updated content",
};

describe("NoteService", () => {
  describe("create", () => {
    it("should create a note with valid input", async () => {
      const service = createService();
      const note = await service.create(validCreateInput);

      expect(note.id).toBeDefined();
      expect(note.contactId).toBe("contact-new");
      expect(note.content).toBe("Test note content");
      expect(note.authorId).toBe("user-test");
      expect(note.createdAt).toBeDefined();
      expect(note.updatedAt).toBe(note.createdAt);
      expect(note.archivedAt).toBeNull();
    });

    it("should trim whitespace from input fields", async () => {
      const service = createService();
      const note = await service.create({
        contactId: "  contact-new  ",
        content: "  Test content  ",
        authorId: "  user-test  ",
      });

      expect(note.contactId).toBe("contact-new");
      expect(note.content).toBe("Test content");
      expect(note.authorId).toBe("user-test");
    });

    it("should throw ValidationError when content is empty", async () => {
      const service = createService();

      await expect(service.create({ ...validCreateInput, content: "" })).rejects.toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError when content is only whitespace", async () => {
      const service = createService();

      await expect(service.create({ ...validCreateInput, content: "   " })).rejects.toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError when contactId is missing", async () => {
      const service = createService();

      await expect(service.create({ ...validCreateInput, contactId: "" })).rejects.toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError when authorId is missing", async () => {
      const service = createService();

      await expect(service.create({ ...validCreateInput, authorId: "" })).rejects.toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError with all field errors when multiple fields are invalid", async () => {
      const service = createService();

      try {
        await service.create({ contactId: "", content: "", authorId: "" });
        expect.unreachable("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.fields.length).toBe(3);
        expect(validationError.fields.map((f) => f.field).sort()).toEqual([
          "authorId",
          "contactId",
          "content",
        ]);
      }
    });

    it("should persist created note and retrieve it", async () => {
      const service = createService();
      const created = await service.create(validCreateInput);
      const retrieved = await service.getById(created.id);

      expect(retrieved).toEqual(created);
    });
  });

  describe("getByContact", () => {
    it("should return all notes for a contact", async () => {
      const service = createService(seedNotes);
      const notes = await service.getByContact("contact-alice");

      expect(notes).toHaveLength(2);
      expect(notes.map((n) => n.id).sort()).toEqual(["note-alice-1", "note-alice-2"]);
    });

    it("should return empty array for contact with no notes", async () => {
      const service = createService(seedNotes);
      const notes = await service.getByContact("contact-unknown");

      expect(notes).toEqual([]);
    });

    it("should include archived notes in results", async () => {
      const service = createService(seedNotes);
      const notes = await service.getByContact("contact-bob");

      expect(notes).toHaveLength(1);
      expect(notes[0].id).toBe("note-bob-1");
      expect(notes[0].archivedAt).not.toBeNull();
    });

    it("should return copies not references", async () => {
      const service = createService(seedNotes);
      const notes = await service.getByContact("contact-carol");
      notes[0].content = "mutated";

      const notesAgain = await service.getByContact("contact-carol");
      expect(notesAgain[0].content).toBe("Carol shared her public key for encrypted messaging.");
    });

    it("should throw ValidationError for empty contactId", async () => {
      const service = createService();

      await expect(service.getByContact("")).rejects.toThrow(ValidationError);
    });

    it("should throw ValidationError for whitespace-only contactId", async () => {
      const service = createService();

      await expect(service.getByContact("   ")).rejects.toThrow(ValidationError);
    });
  });

  describe("getById", () => {
    it("should return the note when it exists", async () => {
      const service = createService(seedNotes);
      const note = await service.getById("note-alice-1");

      expect(note.id).toBe("note-alice-1");
      expect(note.contactId).toBe("contact-alice");
    });

    it("should throw NoteNotFoundError when note does not exist", async () => {
      const service = createService(seedNotes);

      await expect(service.getById("non-existent")).rejects.toThrow(NoteNotFoundError);
    });

    it("should throw NoteNotFoundError with the requested id", async () => {
      const service = createService(seedNotes);

      try {
        await service.getById("missing-id");
        expect.unreachable("Expected NoteNotFoundError to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(NoteNotFoundError);
        expect((error as NoteNotFoundError).noteId).toBe("missing-id");
      }
    });

    it("should return a copy not a reference", async () => {
      const service = createService(seedNotes);
      const note = await service.getById("note-dave-1");
      note.content = "mutated";

      const noteAgain = await service.getById("note-dave-1");
      expect(noteAgain.content).toBe("Dave requested pricing for the enterprise tier.");
    });
  });

  describe("update", () => {
    it("should update note content", async () => {
      const service = createService(seedNotes);
      const updated = await service.update("note-alice-1", validUpdateInput);

      expect(updated.content).toBe("Updated content");
      expect(updated.updatedAt).not.toBe(updated.createdAt);
    });

    it("should preserve fields not included in update", async () => {
      const service = createService(seedNotes);
      const updated = await service.update("note-alice-1", { content: "Only content changed" });

      expect(updated.content).toBe("Only content changed");
      expect(updated.contactId).toBe("contact-alice");
      expect(updated.authorId).toBe("user-current");
    });

    it("should trim content on update", async () => {
      const service = createService(seedNotes);
      const updated = await service.update("note-alice-1", { content: "  trimmed  " });

      expect(updated.content).toBe("trimmed");
    });

    it("should throw ValidationError when content is empty string on update", async () => {
      const service = createService(seedNotes);

      await expect(service.update("note-alice-1", { content: "" })).rejects.toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError when content is only whitespace on update", async () => {
      const service = createService(seedNotes);

      await expect(service.update("note-alice-1", { content: "   " })).rejects.toThrow(
        ValidationError,
      );
    });

    it("should throw NoteNotFoundError when note does not exist", async () => {
      const service = createService(seedNotes);

      await expect(service.update("non-existent", validUpdateInput)).rejects.toThrow(
        NoteNotFoundError,
      );
    });

    it("should throw ValidationError for empty id", async () => {
      const service = createService(seedNotes);

      await expect(service.update("", validUpdateInput)).rejects.toThrow(ValidationError);
    });

    it("should persist update changes", async () => {
      const service = createService(seedNotes);
      await service.update("note-carol-1", { content: "Updated public key info" });
      const retrieved = await service.getById("note-carol-1");

      expect(retrieved.content).toBe("Updated public key info");
    });
  });

  describe("delete", () => {
    it("should delete an existing note", async () => {
      const service = createService(seedNotes);
      await service.delete("note-dave-1");

      await expect(service.getById("note-dave-1")).rejects.toThrow(NoteNotFoundError);
    });

    it("should throw NoteNotFoundError when note does not exist", async () => {
      const service = createService(seedNotes);

      await expect(service.delete("non-existent")).rejects.toThrow(NoteNotFoundError);
    });

    it("should throw ValidationError for empty id", async () => {
      const service = createService(seedNotes);

      await expect(service.delete("")).rejects.toThrow(ValidationError);
    });

    it("should reduce note count after deletion", async () => {
      const service = createService(seedNotes);
      const before = await service.getByContact("contact-alice");
      expect(before).toHaveLength(2);

      await service.delete("note-alice-1");

      const after = await service.getByContact("contact-alice");
      expect(after).toHaveLength(1);
      expect(after[0].id).toBe("note-alice-2");
    });
  });

  describe("archive", () => {
    it("should archive an unarchived note", async () => {
      const service = createService(seedNotes);
      const archived = await service.archive("note-alice-1");

      expect(archived.archivedAt).not.toBeNull();
      expect(archived.updatedAt).not.toBe(archived.createdAt);
    });

    it("should return the archived note", async () => {
      const service = createService(seedNotes);
      const archived = await service.archive("note-alice-1");

      expect(archived.id).toBe("note-alice-1");
      expect(archived.content).toBe(
        "Alice prefers email communication over phone. Best time to reach is before noon.",
      );
    });

    it("should not change archivedAt if note is already archived", async () => {
      const service = createService(seedNotes);
      const original = await service.getById("note-bob-1");
      const originalArchivedAt = original.archivedAt;

      const archived = await service.archive("note-bob-1");

      expect(archived.archivedAt).toBe(originalArchivedAt);
    });

    it("should persist archive state", async () => {
      const service = createService(seedNotes);
      await service.archive("note-carol-1");
      const retrieved = await service.getById("note-carol-1");

      expect(retrieved.archivedAt).not.toBeNull();
    });

    it("should throw NoteNotFoundError when note does not exist", async () => {
      const service = createService(seedNotes);

      await expect(service.archive("non-existent")).rejects.toThrow(NoteNotFoundError);
    });

    it("should throw ValidationError for empty id", async () => {
      const service = createService(seedNotes);

      await expect(service.archive("")).rejects.toThrow(ValidationError);
    });
  });

  describe("loading states", () => {
    it("should return a Promise from all operations", () => {
      const service = createService(seedNotes);

      const createResult = service.create(validCreateInput);
      expect(createResult).toBeInstanceOf(Promise);

      const getByContactResult = service.getByContact("contact-alice");
      expect(getByContactResult).toBeInstanceOf(Promise);

      const getByIdResult = service.getById("note-alice-1");
      expect(getByIdResult).toBeInstanceOf(Promise);

      const updateResult = service.update("note-alice-1", validUpdateInput);
      expect(updateResult).toBeInstanceOf(Promise);

      const deleteResult = service.delete("note-alice-1");
      expect(deleteResult).toBeInstanceOf(Promise);

      const archiveResult = service.archive("note-alice-2");
      expect(archiveResult).toBeInstanceOf(Promise);
    });

    it("should resolve immediately with delayMs 0", async () => {
      const service = createService(seedNotes);
      const start = performance.now();
      await service.getById("note-alice-1");
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
    });
  });

  describe("error states", () => {
    it("should throw ValidationError with descriptive fields", async () => {
      const service = createService();

      try {
        await service.create({ contactId: "", content: "", authorId: "" });
        expect.unreachable("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const ve = error as ValidationError;
        expect(ve.name).toBe("ValidationError");
        expect(ve.message).toBe("Validation failed");
        expect(ve.fields).toEqual(
          expect.arrayContaining([
            { field: "contactId", message: "contactId is required" },
            { field: "content", message: "content is required" },
            { field: "authorId", message: "authorId is required" },
          ]),
        );
      }
    });

    it("should throw NoteNotFoundError with note id", async () => {
      const service = createService();

      try {
        await service.getById("missing-id");
        expect.unreachable("Expected NoteNotFoundError to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(NoteNotFoundError);
        const nfe = error as NoteNotFoundError;
        expect(nfe.name).toBe("NoteNotFoundError");
        expect(nfe.message).toContain("missing-id");
        expect(nfe.noteId).toBe("missing-id");
      }
    });
  });

  describe("determinism", () => {
    it("should produce identical results for the same seeded input", async () => {
      const serviceA = createService(seedNotes);
      const serviceB = createService(seedNotes);

      const notesA = await serviceA.getByContact("contact-alice");
      const notesB = await serviceB.getByContact("contact-alice");

      expect(notesA).toEqual(notesB);
    });

    it("should produce identical validation errors for the same invalid input", async () => {
      const serviceA = createService();
      const serviceB = createService();

      const tryGetError = async (service: NoteService) => {
        try {
          await service.create({ contactId: "", content: "", authorId: "" });
          return null;
        } catch (error) {
          return error as ValidationError;
        }
      };

      const errorA = await tryGetError(serviceA);
      const errorB = await tryGetError(serviceB);

      expect(errorA).not.toBeNull();
      expect(errorB).not.toBeNull();
      expect(errorA!.fields).toEqual(errorB!.fields);
    });

    it("should produce identical not-found errors for the same missing id", async () => {
      const serviceA = createService(seedNotes);
      const serviceB = createService(seedNotes);

      const tryGetError = async (service: NoteService) => {
        try {
          await service.getById("missing-id");
          return null;
        } catch (error) {
          return error as NoteNotFoundError;
        }
      };

      const errorA = await tryGetError(serviceA);
      const errorB = await tryGetError(serviceB);

      expect(errorA).not.toBeNull();
      expect(errorB).not.toBeNull();
      expect(errorA!.message).toBe(errorB!.message);
      expect(errorA!.noteId).toBe(errorB!.noteId);
    });
  });

  describe("empty service", () => {
    it("should start with no notes", async () => {
      const service = createService();
      const notes = await service.getByContact("anything");

      expect(notes).toEqual([]);
    });

    it("should allow creating notes after construction", async () => {
      const service = createService();
      const note = await service.create(validCreateInput);

      expect(note.id).toBeDefined();
      const retrieved = await service.getById(note.id);
      expect(retrieved.id).toBe(note.id);
    });
  });
});
