# Email Translator

Email Translator is an isolated V2 individual tool workspace for translating
email body content between languages before a future mail-app integration.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/individual/email-translator/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Current Status

This folder now contains an isolated UI surface for the translator workflow. It
does not call live translation providers, read inbox data, send email, or persist
translated output. Future core-service issues can connect the UI to a local
translation provider contract.

## Reviewer Setup

Run the local contract test from the repository root:

```bash
node tools/v2/individual/email-translator/tests/ui-contract.test.mjs
```

## UI Workflow

1. Show empty, loading, error, and translated states.
2. Let users choose source and target languages with labelled native selects.
3. Render translated examples with confidence, warnings, preserved elements, and
   copy actions.
4. Keep translation actions callback-based until a future service issue wires the
   provider layer.

## Documentation Map

- `ARCHITECTURE.md` documents the folder-local module boundary.
- `components/` contains the isolated React UI surface.
- `fixtures/sample-translations.json` contains deterministic synthetic examples.
- `docs/ACCESSIBILITY.md` documents keyboard, focus, and screen-reader behavior.
- `docs/VISUAL_STYLE.md` documents the local visual treatment.
- `tests/ui-contract.test.mjs` validates the fixture and accessibility contract.

## Known Limitations

- This contribution does not add live translation.
- Copy behavior is exposed as local UI logic and callbacks only.
- Inbox, compose, provider configuration, secrets, and persistence remain out of
  scope for this isolated V2 folder.
