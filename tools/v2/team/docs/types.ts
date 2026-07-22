/**
 * types.ts — Docs (non-UI execution contract)
 *
 * Domain types for a documentation index. No imports from the main app;
 * presentation-free.
 */

/** A documentation entry in the index. */
export interface DocEntry {
  /** Stable doc id. */
  id: string;
  /** Human-readable title. */
  title: string;
  /** Source path or URL. */
  path: string;
  /** Optional section/tags. */
  tags?: string[];
}

/** A resolved, normalized doc descriptor returned by the contract. */
export interface ResolvedDoc {
  id: string;
  title: string;
  path: string;
  tags: string[];
}

/** Input for resolving a doc by id or path. */
export interface ResolveDocInput {
  /** Doc id (preferred) or path. */
  ref: string;
}
