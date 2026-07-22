# Draft Improver

Draft Improver is an isolated V2 individual tool workspace for improving draft
quality before sending. It detects spelling errors, tone concerns, clarity and
structural issues, missing fields, and sensitive content -- all with actionable
suggestions.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/individual/draft-improver/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Reviewer Setup

This issue adds folder-local UI components, a deterministic analysis engine
with validation and sanitisation guards, synthetic fixtures, and a standalone
Node test. No app install is required to review the fixture contract.

Run from the repository root:

```bash
node --test tools/v2/individual/draft-improver/tests/draft-fixtures.test.mjs
```

The test validates synthetic sample drafts and expected issue categories.

## Tool Workflow

1. Accept draft input through local `DraftInput` objects.
2. Validate input types, sizes, and fields (`validateDraftInput`).
3. Sanitise text (truncate, strip control characters) (`sanitizeDraft`).
4. Parse structure (greeting, closing, action items, word/sentence counts)
   (`parseDraft`).
5. Analyse for issues: spelling, missing fields, clarity, tone, length,
   action items, and sensitive content.
6. Score the draft across subject, body, clarity, tone, and structure.
7. Present results with severity-based filtering and actionable suggestions.

## UI Surface

The folder-local React components cover:

- empty state when no draft is available
- loading state with `aria-busy` and screen-reader status text
- error state with retry affordance
- success state with score display, summary metrics, dual filter controls
  (category + severity), and issue cards with inline suggestions

The components are exported from `components/index.ts` and the folder entrypoint
`index.ts`.

## Fixture Coverage

`fixtures/sample-drafts.json` includes synthetic examples for:

- spelling error ("recieved")
- ambiguous request needing action item
- empty subject line with spelling error ("definately")
- sensitive content (API key, secret)
- clean well-formed draft

No real sender, recipient, or personal data is used.

## Documentation Map

- `specs.md` defines scope, status rules, and the local analysis contract.
- `docs/SECURITY_AND_PERFORMANCE.md` documents threat assumptions, unsafe
  inputs, validation guards, and performance notes for large data.
- `docs/ACCESSIBILITY.md` documents keyboard, focus, and screen-reader
  behaviour.
- `docs/VISUAL_STYLE.md` documents the local visual treatment.
- `docs/TEST_PLAN.md` lists automated and manual review checks.
- `tests/draft-fixtures.test.mjs` validates the fixture contract.

## Known Limitations

- This contribution does not register the tool in app routing.
- The spell checker uses a fixed dictionary of common misspellings only.
- Sensitive content detection uses pattern matching and may produce false
  positives or miss novel patterns.
- Live mailbox integration, compose UI wiring, and draft persistence remain
  out of scope.
