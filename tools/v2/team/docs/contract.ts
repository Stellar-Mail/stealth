/**
 * contract.ts — Docs (non-UI execution contract)
 *
 * Backend-facing execution contract for a documentation index. It is
 * presentation-free: no React, no DOM. Operations return a typed
 * `DocResult<T>` discriminated union with explicit error codes instead of
 * throwing.
 */

import type { DocEntry, ResolvedDoc, ResolveDocInput } from "./types";

/** Explicit, machine-readable error codes for contract operations. */
export enum DocErrorCode {
  /** The reference was missing/empty or malformed. */
  InvalidInput = "INVALID_INPUT",
  /** No doc matched the given id or path. */
  DocNotFound = "DOC_NOT_FOUND",
}

/** Discriminated outcome returned by every contract operation. */
export type DocResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: DocErrorCode; message: string };

/** Operations supported by the docs contract. */
export type DocOperation = { operation: "resolve"; input: ResolveDocInput };

/** Output produced by the contract, keyed by operation. */
export type DocContractOutput = {
  operation: "resolve";
  doc: ResolvedDoc;
};

/** Backend-facing entry point for the docs contract. */
export interface DocsContract {
  execute(input: DocOperation, index: DocEntry[]): DocResult<DocContractOutput>;
}

/** Typed success outcome. */
export function ok<T>(value: T): DocResult<T> {
  return { ok: true, value };
}

/** Typed error outcome. */
export function fail<T = never>(error: DocErrorCode, message: string): DocResult<T> {
  return { ok: false, error, message };
}

/** Normalize an index entry into a `ResolvedDoc`. */
export function toResolvedDoc(entry: DocEntry): ResolvedDoc {
  return {
    id: entry.id,
    title: entry.title,
    path: entry.path,
    tags: entry.tags ?? [],
  };
}

/**
 * Pure resolver. Looks up a doc by id first, then by path. Deterministic.
 */
export function resolveDoc(ref: string, index: DocEntry[]): DocResult<ResolvedDoc> {
  if (typeof ref !== "string" || ref.trim() === "") {
    return fail(DocErrorCode.InvalidInput, "ref is required");
  }
  const byId = index.find((d) => d.id === ref);
  if (byId) return ok(toResolvedDoc(byId));
  const byPath = index.find((d) => d.path === ref);
  if (byPath) return ok(toResolvedDoc(byPath));
  return fail(DocErrorCode.DocNotFound, `Doc not found: ${ref}`);
}

/** Validate inputs before resolving. */
export function validateResolveDoc(input: ResolveDocInput, index: DocEntry[]): string | null {
  if (!Array.isArray(index)) return "index must be an array";
  if (!input || typeof input.ref !== "string" || input.ref.trim().length === 0)
    return "ref is required";
  return null;
}

/** Build the docs execution contract from an index. */
export function createDocsContract(): DocsContract {
  return {
    execute(input: DocOperation, index: DocEntry[]): DocResult<DocContractOutput> {
      try {
        if (input.operation !== "resolve") {
          return fail(DocErrorCode.InvalidInput, `Unknown operation: ${input.operation}`);
        }
        const err = validateResolveDoc(input.input, index);
        if (err) return fail(DocErrorCode.InvalidInput, err);
        const res = resolveDoc(input.input.ref, index);
        if (!res.ok) return res;
        return ok({ operation: "resolve", doc: res.value });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return fail(DocErrorCode.InvalidInput, message);
      }
    },
  };
}
