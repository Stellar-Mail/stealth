/**
 * kb-suggestion.service.ts — Knowledge Base Suggestion (non-UI service)
 *
 * Presentation-free service boundary for the KB suggestion contract. Wraps the
 * pure `suggestKb` reducer into a `KbContract` whose `execute(...)` returns
 * typed success/error results (including the NO_MATCH case) instead of throwing.
 */

import {
  KbErrorCode,
  ok,
  type KbContract,
  type KbOperation,
  type KbContractOutput,
  type KbResult,
  suggestKb,
  validateSuggest,
  fail,
} from "../contract";
import type { KbArticle } from "../types";

/** Build the KB suggestion execution contract. */
export function createKbSuggestionService(): KbContract {
  return {
    execute(input: KbOperation, corpus: KbArticle[]): KbResult<KbContractOutput> {
      try {
        if (input.operation !== "suggest") {
          return fail(KbErrorCode.InvalidInput, `Unknown operation: ${input.operation}`);
        }
        const err = validateSuggest(input.input, corpus);
        if (err) return fail(KbErrorCode.InvalidInput, err);
        const suggestions = suggestKb(input.input.query, corpus, input.input.limit ?? 5);
        if (suggestions.length === 0) {
          return fail(KbErrorCode.NoMatch, "No matching articles found");
        }
        return ok({ operation: "suggest", suggestions });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return fail(KbErrorCode.InvalidInput, message);
      }
    },
  };
}
