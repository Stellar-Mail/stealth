# Email Tone Rewriter

This folder is the isolated workspace for the Email Tone Rewriter tool.

## Ownership Boundary

All work for this tool must stay inside:

`text
.\tools\v1\individual\email-tone-rewriter\
`

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Contributor Setup

The folder now includes a reviewable, folder-local core service for the V1
feature issue:

- `services.ts` exposes the pure rewrite API, validation helpers, and preserved
  key-point extraction.
- `services.test.ts` covers supported tones, validation errors, key-point
  preservation, disabled send/save flags, and length constraints.
- `specs.md` defines the behavior and ownership boundary.
- `docs/test-plan.md` lists the acceptance scenarios future component tests
  should cover.
- `docs/fixtures.md` describes synthetic rewrite requests and expected outputs.
- `REVIEW_NOTES.md` gives reviewers a quick checklist for this isolated work.

## Intended Usage

The tool helps an individual user rewrite a draft email into a selected tone,
such as concise, friendly, formal, or apologetic. A future implementation should
accept a draft, requested tone, and optional constraints, then return a
reviewable rewrite without sending or saving anything automatically.

## Known Limitations

- This issue adds the pure core service only; UI, integration, send actions, and
  persistence are intentionally out of scope until a future integration issue
  allows them.
- The rewrite is deterministic and local. It does not call external AI providers,
  production APIs, or mailbox data.
