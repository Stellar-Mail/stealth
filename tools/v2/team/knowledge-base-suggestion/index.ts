/**
 * index.ts — Knowledge Base Suggestion
 *
 * Folder-local API surface. Exports the non-UI execution contract, its types,
 * and the service factory. Nothing here imports from the main app.
 */

// Types
export type { KbArticle, KbSuggestion, SuggestInput } from "./types";

// Contract + service
export { createKbSuggestionService } from "./services/kb-suggestion.service";
export { KbErrorCode, suggestKb, tokenize, validateSuggest, ok, fail } from "./contract";
export type { KbContract, KbOperation, KbContractOutput, KbResult } from "./contract";

// Fixtures
export { KB_ARTICLES } from "./fixtures";
