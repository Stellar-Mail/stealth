# Knowledge Base Suggestion — Review Notes

Isolated V2 "team" tool. All review material for this tool lives in this folder.
The component is `KnowledgeBaseSuggestion.tsx` (presentational; state is held
locally with `useState`).

## What to review

1. **Component** — `KnowledgeBaseSuggestion.tsx` renders five visual states:
   `idle`, `loading`, `empty`, `error`, `success`. State is toggled by the demo
   buttons in the header.
2. **Accessibility** — the output region is `aria-live="polite"`, the loading
   region is `aria-busy`, and the error uses `role="alert"`.
3. **Tests** — `__tests__/KnowledgeBaseSuggestion.test.tsx` (vitest +
   `@testing-library/react` + `jsdom`).

## How to run the tests

```sh
# from repo root
npm install
npx vitest run src/tools/v2/team/knowledge-base-suggestion
```

Expected: all state transitions render the correct region/alert/list, and the
accessible region is exposed.

## Known limitations

- This is a UI demo shell: it does not call a real knowledge-base indexer and
  the "success" articles are hard-coded. A non-UI execution contract / scoring
  layer is tracked separately and should be wired in once available.
- No persistence or routing; fully isolated per the issue boundary.
