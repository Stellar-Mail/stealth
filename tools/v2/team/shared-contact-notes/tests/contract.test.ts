/**
 * contract.test.ts — Shared Contact Notes (execution contract)
 *
 * Verifies the non-UI execution contract: typed inputs/outputs, the full
 * create -> get -> update -> archive -> delete lifecycle, and the edge/error
 * paths (validation, unknown note). No UI is exercised. The underlying
 * NoteService is synchronous (delayMs: 0) and in-memory.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { NoteService } from "../service";
import { createNotesContract } from "../contract";
import { NoteErrorCode, ok, fail, type NotesResult, type NotesContractOutput } from "../contract";
import { VALID_CREATE_INPUT, INVALID_CREATE_INPUT } from "../contract.fixtures";

function makeContract() {
  const service = new NoteService([], { delayMs: 0 });
  return createNotesContract(service);
}

describe("notes contract — result helpers", () => {
  it("ok() produces a typed success result", () => {
    const r = ok("v");
    expect(r).toEqual({ ok: true, value: "v" });
  });

  it("fail() produces a typed error result with code + message", () => {
    const r = fail(NoteErrorCode.NoteNotFound, "missing");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(NoteErrorCode.NoteNotFound);
      expect(r.message).toBe("missing");
    }
  });
});

describe("notes contract — lifecycle", () => {
  let contract: ReturnType<typeof makeContract>;
  beforeEach(() => {
    contract = makeContract();
  });

  it("create returns a new note with a generated id", async () => {
    const res = await contract.execute({ operation: "create", input: VALID_CREATE_INPUT });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "create") {
      expect(res.value.note.id).toBeTruthy();
      expect(res.value.note.contactId).toBe("contact-acme");
      expect(res.value.note.archivedAt).toBeNull();
    }
  });

  it("getByContact returns notes for a contact", async () => {
    const created = await contract.execute({ operation: "create", input: VALID_CREATE_INPUT });
    const id = created.ok && created.value.operation === "create" ? created.value.note.id : "";
    const res = await contract.execute({ operation: "getById", id });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "getById") {
      expect(res.value.note.id).toBe(id);
    }
    const byContact = await contract.execute({
      operation: "getByContact",
      contactId: "contact-acme",
    });
    if (byContact.ok && byContact.value.operation === "getByContact") {
      expect(byContact.value.notes.length).toBe(1);
    }
  });

  it("update changes content and bumps updatedAt", async () => {
    const created = await contract.execute({ operation: "create", input: VALID_CREATE_INPUT });
    const id = created.ok && created.value.operation === "create" ? created.value.note.id : "";
    const res = await contract.execute({
      operation: "update",
      id,
      input: { content: "Updated: prefers Slack over email." },
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "update") {
      expect(res.value.note.content).toBe("Updated: prefers Slack over email.");
    }
  });

  it("archive sets archivedAt", async () => {
    const created = await contract.execute({ operation: "create", input: VALID_CREATE_INPUT });
    const id = created.ok && created.value.operation === "create" ? created.value.note.id : "";
    const res = await contract.execute({ operation: "archive", id });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "archive") {
      expect(res.value.note.archivedAt).not.toBeNull();
    }
  });

  it("delete removes a note (reports deletedId)", async () => {
    const created = await contract.execute({ operation: "create", input: VALID_CREATE_INPUT });
    const id = created.ok && created.value.operation === "create" ? created.value.note.id : "";
    const res = await contract.execute({ operation: "delete", id });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "delete") {
      expect(res.value.deletedId).toBe(id);
    }
    const after = await contract.execute({ operation: "getById", id });
    expect(after.ok).toBe(false);
  });
});

describe("notes contract — error handling", () => {
  it("create rejects empty content (no throw)", async () => {
    const contract = makeContract();
    const res: NotesResult<NotesContractOutput> = await contract.execute({
      operation: "create",
      input: INVALID_CREATE_INPUT,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(NoteErrorCode.InvalidInput);
  });

  it("getById of an unknown note maps to NoteNotFound (no throw)", async () => {
    const contract = makeContract();
    const res: NotesResult<NotesContractOutput> = await contract.execute({
      operation: "getById",
      id: "note-does-not-exist",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(NoteErrorCode.NoteNotFound);
  });
});
