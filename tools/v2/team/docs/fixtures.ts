/**
 * fixtures.ts — Docs (execution contract fixtures)
 *
 * Deterministic local fixtures used by the contract tests and as documentation
 * of the contract shape.
 */

import type { DocEntry } from "./types";

/** A small deterministic documentation index. */
export const DOC_INDEX: DocEntry[] = [
  {
    id: "doc-getting-started",
    title: "Getting Started",
    path: "docs/getting-started.md",
    tags: ["onboarding"],
  },
  {
    id: "doc-api-reference",
    title: "API Reference",
    path: "docs/api/reference.md",
    tags: ["api"],
  },
  {
    id: "doc-contributing",
    title: "Contributing Guide",
    path: "docs/CONTRIBUTING.md",
    tags: ["contributing", "dev"],
  },
];
