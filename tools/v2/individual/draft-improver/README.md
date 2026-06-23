# Draft Improver

Draft Improver is an isolated V2 individual tool workspace for reviewing and
improving email drafts before sending.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/individual/draft-improver/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Reviewer Setup

This issue adds folder-local documentation, fixtures, and a standalone Node
test. No app install or live service is required to review the contribution.

Run from the repository root:

```bash
node tools/v2/individual/draft-improver/tests/draft-improver-service.test.mjs
```

## Core Workflow

1. Normalize a draft into subject, body, tone, audience, and channel fields.
2. Evaluate clarity, tone, actionability, formatting, and privacy risk.
3. Return review status, score, detected issues, suggestions, and a deterministic
   improved draft.
4. Keep all state folder-local so a future UI can consume the API without
   touching the main app.

## Documentation Map

- `services/draft-improver-service.mjs` exposes the pure core engine.
- `fixtures/sample-drafts.json` contains deterministic review examples.
- `docs/contract.md` documents inputs, outputs, loading states, and error states.
- `tests/draft-improver-service.test.mjs` validates the local contract.

## Known Limitations

- This contribution does not add app UI or live email sending.
- Suggestions are deterministic heuristics, not AI-generated rewrites.
- Mailbox access, contact lookup, attachment handling, and delivery remain out
  of scope for this isolated V2 folder.
