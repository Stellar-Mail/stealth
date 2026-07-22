/**
 * index.ts — Team Digest Generator
 *
 * Folder-local API surface for the execution contract. Exports the non-UI
 * digest contract, its types, and the service factory. Nothing here imports
 * from the main app.
 */

// Aggregation logic (existing)
export { generateTeamDigest } from "./src/digestGenerator";
export type { TeamDigestItem, TeamDigestSummary } from "./src/digestGenerator";

// Contract + service
export { createDigestContract } from "./contract";
export { DigestErrorCode, validateDigestInput, ok, fail } from "./contract";
export type {
  DigestContract,
  DigestOperation,
  DigestContractOutput,
  DigestResult,
} from "./contract";

// Contract fixtures
export { DIGEST_FIXTURES, EMPTY_ITEMS } from "./contract.fixtures";
