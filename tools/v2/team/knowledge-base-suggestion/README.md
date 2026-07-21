# Knowledge Base Suggestion

This folder is the isolated workspace for the Knowledge Base Suggestion tool — a
presentation-free service that matches a query to internal documentation
articles and ranks them by relevance.

## Status

All work for this tool must stay inside:
`tools/v2/team/knowledge-base-suggestion/`

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, or design system unless a future integration issue
explicitly allows it.

## Non-UI execution contract

The suggestion logic exposes a presentation-free execution contract so it can
run as a backend service, independent of any UI.

- `types.ts` — domain types: `KbArticle`, `KbSuggestion`, `SuggestInput`.
- `contract.ts` — the typed `KbOperation` / `KbContractOutput`, the `KbResult<T>`
  discriminated union, explicit `KbErrorCode` values, the pure `suggestKb`
  reducer (tag-overlap + title-keyword scoring, deterministic ranking), and
  `validateSuggest`.
- `services/kb-suggestion.service.ts` — `createKbSuggestionService()` returns a
  `KbContract` whose `execute(query, corpus)` returns typed success/error
  results (including the `NO_MATCH` case) instead of throwing.
- `fixtures.ts` — deterministic sample articles.
- `tests/contract.test.ts` — vitest coverage of ranking, limit, and the
  empty-query / no-match / invalid-corpus error paths.

Usage:

```ts
import { createKbSuggestionService } from ".";

const contract = createKbSuggestionService();
const res = contract.execute({ operation: "suggest", input: { query: "invoice billing" } }, corpus);
if (res.ok && res.value.operation === "suggest") {
  // res.value.suggestions is ranked by relevance
} else {
  // res.error is a KbErrorCode
}
```
