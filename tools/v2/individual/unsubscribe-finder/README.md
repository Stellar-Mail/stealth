# Unsubscribe Finder

Unsubscribe Finder is an isolated V2 individual tool workspace for detecting
newsletter, marketing, and notification emails that expose safe unsubscribe
options before a future inbox integration.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/individual/unsubscribe-finder/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Reviewer Setup

This issue adds folder-local documentation, fixtures, and a standalone Node test.
No app install is required to review the contribution.

Run from the repository root:

```bash
node --test tools/v2/individual/unsubscribe-finder/tests/unsubscribe-fixtures.test.mjs
```

The test validates the sample unsubscribe fixture against the local review
contract described in `specs.md`.

## Detection Workflow

1. Capture synthetic email records with headers, sender metadata, and body hints.
2. Normalize unsubscribe signals into method, confidence, safety, and source.
3. Route each candidate to `detected`, `needs-review`, `unsafe`, or `ignored`.
4. Preserve source message ids for reviewability.
5. Keep all unsubscribe actions manual until a future safety issue defines live
   behavior.

## Fixtures

The folder-local fixture at `fixtures/sample-unsubscribe-candidates.json`
contains:

- a newsletter with a standards-based `List-Unsubscribe` header
- a promotional email with an unsubscribe link that needs review
- a phishing-like message whose unsubscribe target is unsafe
- a transactional message that should be ignored

The fixture intentionally uses `example.test` addresses, synthetic URLs, and fake
message ids so contributors can validate behavior without using real mailbox
content or personal subscription data.

## Documentation Map

- `specs.md` defines the local unsubscribe candidate contract and scope.
- `docs/test-plan.md` lists automated and manual review steps.
- `docs/review-notes.md` explains validation and known limits.
- `tests/unsubscribe-fixtures.test.mjs` validates the fixture contract.

## Known Limitations

- This contribution does not add app UI or live email scanning.
- Detection behavior is represented through fixture expectations only.
- One-click unsubscribe, sender reputation checks, and mailbox mutations remain
  out of scope for this isolated V2 folder.
