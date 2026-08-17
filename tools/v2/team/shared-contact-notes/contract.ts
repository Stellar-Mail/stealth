/**
 * contract.ts — Shared Contact Notes (non-UI execution contract)
 *
 * Backend-facing execution contract for shared notes on a contact. It is
 * presentation-free: no React, no DOM. Operations return a typed
 * `NotesResult<T>` discriminated union with explicit error codes instead of
 * throwing.
 *
 * The underlying stateful logic already exists in `./service` (`NoteService`,
 * which throws `ValidationError` / `NoteNotFoundError`); this contract wraps it
 * so callers receive typed results rather than catching exceptions.
 */

import { NoteService } from "./service";
import { NoteNotFoundError, ValidationError } from "./errors";
import type { ContactId, CreateNoteInput, Note, NoteId, UpdateNoteInput } from "./types";

/** Explicit, machine-readable error codes for contract operations. */
export enum NoteErrorCode {
  /** Input failed validation (missing/empty fields). */
  InvalidInput = "INVALID_INPUT",
  /** The referenced note was not found. */
  NoteNotFound = "NOTE_NOT_FOUND",
}

/** Discriminated outcome returned by every contract operation. */
export type NotesResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: NoteErrorCode; message: string };

/** Operations supported by the notes contract. */
export type NotesOperation =
  | { operation: "create"; input: CreateNoteInput }
  | { operation: "getByContact"; contactId: ContactId }
  | { operation: "getById"; id: NoteId }
  | { operation: "update"; id: NoteId; input: UpdateNoteInput }
  | { operation: "delete"; id: NoteId }
  | { operation: "archive"; id: NoteId };

/** Output produced by the contract, keyed by operation. */
export type NotesContractOutput =
  | { operation: "create"; note: Note }
  | { operation: "getByContact"; notes: Note[] }
  | { operation: "getById"; note: Note }
  | { operation: "update"; note: Note }
  | { operation: "delete"; deletedId: NoteId }
  | { operation: "archive"; note: Note };

/** Backend-facing entry point for shared contact notes. */
export interface NotesContract {
  execute(input: NotesOperation): Promise<NotesResult<NotesContractOutput>>;
}

/** Typed success outcome. */
export function ok<T>(value: T): NotesResult<T> {
  return { ok: true, value };
}

/** Typed error outcome. */
export function fail<T = never>(error: NoteErrorCode, message: string): NotesResult<T> {
  return { ok: false, error, message };
}

/** Map a thrown service error to a typed contract result. */
function toResult<T>(err: unknown): NotesResult<T> {
  if (err instanceof ValidationError) {
    return fail(NoteErrorCode.InvalidInput, err.message);
  }
  if (err instanceof NoteNotFoundError) {
    return fail(NoteErrorCode.NoteNotFound, err.message);
  }
  const message = err instanceof Error ? err.message : String(err);
  return fail(NoteErrorCode.InvalidInput, message);
}

/**
 * Build the notes execution contract from a `NoteService` instance.
 *
 * The contract adapts the service's throwing methods into typed results, so
 * callers never catch exceptions. The service owns all state.
 */
export function createNotesContract(service: NoteService): NotesContract {
  return {
    async execute(input: NotesOperation): Promise<NotesResult<NotesContractOutput>> {
      try {
        switch (input.operation) {
          case "create": {
            const note = await service.create(input.input);
            return ok({ operation: "create", note });
          }
          case "getByContact": {
            const notes = await service.getByContact(input.contactId);
            return ok({ operation: "getByContact", notes });
          }
          case "getById": {
            const note = await service.getById(input.id);
            return ok({ operation: "getById", note });
          }
          case "update": {
            const note = await service.update(input.id, input.input);
            return ok({ operation: "update", note });
          }
          case "delete": {
            await service.delete(input.id);
            return ok({ operation: "delete", deletedId: input.id });
          }
          case "archive": {
            const note = await service.archive(input.id);
            return ok({ operation: "archive", note });
          }
          default: {
            const _never: never = input;
            return fail(NoteErrorCode.InvalidInput, `Unknown operation: ${JSON.stringify(_never)}`);
          }
        }
      } catch (err) {
        return toResult(err);
      }
    },
  };
}
