/**
 * contract.fixtures.ts — Shared Contact Notes (execution contract fixtures)
 *
 * Deterministic local fixtures used by the contract tests and as documentation
 * of the contract shape.
 */

import type { CreateNoteInput } from "./types";

/** A valid note creation input. */
export const VALID_CREATE_INPUT: CreateNoteInput = {
  contactId: "contact-acme",
  content: "Champion wants weekly digest, prefers async updates.",
  authorId: "user-ada",
};

/** A creation input missing content (should fail validation). */
export const INVALID_CREATE_INPUT: CreateNoteInput = {
  contactId: "contact-acme",
  content: "   ",
  authorId: "user-ada",
};
