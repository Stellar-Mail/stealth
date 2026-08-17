/**
 * kb-suggestion.service.ts — Knowledge Base Suggestion (non-UI service)
 *
 * Presentation-free service boundary for the KB suggestion contract.
 * Delegates to the expandable core engine and returns typed success/error results.
 */

import {
  KbErrorCode,
  ok,
  fail,
  suggestKb,
  filterCorpus,
  validateInput,
  type KbContract,
  type KbOperation,
  type KbContractOutput,
  type KbResult,
  type KbCorpusFilter,
} from "../core/engine";
import type { KbArticle } from "../types";

/** Build the KB suggestion execution contract. */
export function createKbSuggestionService(): KbContract {
  return {
    execute(
      input: KbOperation,
      corpus: KbArticle[],
      filters: KbCorpusFilter[] = [],
    ): KbResult<KbContractOutput> {
      try {
        if (input.operation !== "suggest") {
          return fail(KbErrorCode.InvalidInput, `Unknown operation: ${input.operation}`);
        }
        const err = validateInput(input.input, corpus);
        if (err) return fail(KbErrorCode.InvalidInput, err);
        const { suggestions, warnings } = suggestKb(
          input.input.query,
          corpus,
          input.input.limit ?? 5,
          filters,
        );
        if (suggestions.length === 0) {
          return fail(KbErrorCode.NoMatch, "No matching articles found");
        }
        return ok({ operation: "suggest", suggestions, warnings });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return fail(KbErrorCode.InvalidInput, message);
      }
    },
  };
}
