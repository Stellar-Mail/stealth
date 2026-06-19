# Email Tone Rewriter

This folder is the isolated workspace for the Email Tone Rewriter tool.

## Ownership Boundary

All work for this tool must stay inside:

`text
.\tools\v1\individual\email-tone-rewriter\
`

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Contributor Setup

This folder does not contain executable tool code yet. Until a feature issue
adds the implementation, contributors should use these local documents as the
launch contract:

- `specs.md` defines the behavior and ownership boundary.
- `docs/test-plan.md` lists the acceptance scenarios future unit and component
  tests should cover.
- `docs/fixtures.md` describes synthetic rewrite requests and expected outputs.
- `REVIEW_NOTES.md` gives reviewers a quick checklist for this isolated work.

## Intended Usage

The tool helps an individual user rewrite a draft email into a selected tone,
such as concise, friendly, formal, or apologetic. A future implementation should
accept a draft, requested tone, and optional constraints, then return a
reviewable rewrite without sending or saving anything automatically.

## Known Limitations

- No production code is present in this folder yet.
- The documented tests are a plan, not an executable suite.
- Main app routing, inbox integration, send actions, and persistence are
  intentionally out of scope until a future integration issue allows them.
