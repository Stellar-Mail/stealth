# Contact Extractor

Contact Extractor is an isolated V1 individual tool for reviewing contact
details found in email content before a future mail-app integration saves them.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/contact-extractor/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Reviewer Setup

This issue adds a folder-local UI surface, deterministic extraction helpers,
synthetic fixtures, and a standalone Node test.

Run from the repository root:

```bash
node --test tools/v1/individual/contact-extractor/tests/contact-extractor-fixtures.test.mjs
```

The test validates the fixture contract used by the local UI and extraction
helpers.

## Local Workflow

1. Paste or load email text into the local `ContactExtractorUI`.
2. Run extraction with the folder-local helper.
3. Review detected contacts, confidence, evidence, and field-level warnings.
4. Select contacts for a future save/export flow.
5. Keep any real persistence or mailbox mutation out of scope.

## Documentation Map

- `specs.md` defines the input, output, accessibility, and review contract.
- `types.ts` defines the local TypeScript data model.
- `services.ts` contains deterministic contact extraction helpers.
- `fixtures.ts` provides UI-ready synthetic examples.
- `fixtures/sample-contact-emails.json` backs the executable fixture test.
- `ContactExtractorUI.tsx` implements the accessible local UI surface.
- `styles.css` documents the local visual style without changing shared tokens.
- `docs/review-notes.md` and `docs/test-plan.md` guide independent review.

## Known Limitations

- The tool is not mounted in the main app.
- Contacts are not written to any address book or database.
- Extraction is deterministic and local; no model, network, or mailbox calls are
  made.
- Future integration work should add consent, deduplication, persistence, and
  import/export safeguards before touching production contact stores.
