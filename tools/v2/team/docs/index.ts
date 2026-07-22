/**
 * index.ts — Docs
 *
 * Folder-local API surface. Exports the non-UI execution contract, its types,
 * and the service factory. Nothing here imports from the main app.
 */

// Types
export type { DocEntry, ResolvedDoc, ResolveDocInput } from "./types";

// Contract + service
export { createDocsService } from "./services/docs.service";
export {
  createDocsContract,
  resolveDoc,
  toResolvedDoc,
  validateResolveDoc,
  DocErrorCode,
  ok,
  fail,
} from "./contract";
export type { DocsContract, DocOperation, DocContractOutput, DocResult } from "./contract";

// Fixtures
export { DOC_INDEX } from "./fixtures";
