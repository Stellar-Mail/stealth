# Email Summarizer

This folder is the isolated workspace for the Email Summarizer tool.

## Ownership Boundary

All work for this tool must stay inside:

`text
.\tools\v1\individual\email-summarizer\
`

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Contributor Setup

This folder does not contain executable tool code yet. Until a feature issue
adds the implementation, contributors should use these local documents as the
launch contract:

- `specs.md` defines the behavior and ownership boundary.
- `docs/test-plan.md` lists the acceptance scenarios future unit and component
  tests should cover.
- `docs/fixtures.md` describes synthetic emails and expected summary outputs.
- `REVIEW_NOTES.md` gives reviewers a quick checklist for this isolated work.

## Intended Usage

The tool helps an individual user turn a long email into a concise reviewable
summary. A future implementation should accept a normalized email, produce a
short summary, surface action items separately, and preserve enough source
metadata for the user to verify the summary before acting on it.

## Known Limitations

- No production code is present in this folder yet.
- The documented tests are a plan, not an executable suite.
- Main app routing, inbox integration, and persistence are intentionally out of
  scope until a future integration issue allows them.
