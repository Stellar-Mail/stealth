# Confidential Mode Suggestion

Confidential Mode Suggestion is an isolated V2 individual tool workspace for
reviewing draft privacy risks and suggesting safer sending protections before a
future mail-app integration.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/individual/confidential-mode-suggestion/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Reviewer Setup

This issue adds a folder-local UI surface, synthetic fixtures, and standalone
contract tests. No app mount or live mailbox data is required to review the
contribution.

Run from the repository root:

```bash
node tools/v2/individual/confidential-mode-suggestion/tests/ui-contract.test.mjs
```

## UI Workflow

1. Show empty, loading, error, and ready states.
2. Summarize confidential-mode suggestions by state.
3. Let users filter suggestions by `all`, `suggested`, `blocked`, or `safe`.
4. Render accessible action buttons for applying or dismissing each suggestion.
5. Keep the UI folder-local until a future integration issue connects it to the
   mail app.

## Documentation Map

- `components/` contains the isolated React UI surface.
- `fixtures/sample-suggestions.json` contains deterministic synthetic examples.
- `docs/ACCESSIBILITY.md` documents keyboard, focus, and screen-reader behavior.
- `docs/VISUAL_STYLE.md` documents the local visual treatment.
- `tests/ui-contract.test.mjs` validates the fixture and accessibility contract.

## Known Limitations

- This contribution does not add app routing or production mail access.
- Suggestions are supplied as local props instead of being detected live.
- Applying or dismissing a suggestion is exposed as a callback for future UI
  wiring; no mailbox mutation happens here.
