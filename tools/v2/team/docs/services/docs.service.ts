/**
 * docs.service.ts — Docs (non-UI service)
 *
 * Presentation-free service boundary for the docs contract. Wraps the pure
 * `resolveDoc` reducer into a `DocsContract` whose `execute(...)` returns typed
 * success/error results instead of throwing.
 */

import { createDocsContract, type DocsContract } from "../contract";

/** Build the docs execution contract (service entry point). */
export function createDocsService(): DocsContract {
  return createDocsContract();
}
