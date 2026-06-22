# Email Tone Rewriter

This folder is the isolated workspace for the Email Tone Rewriter tool.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/email-tone-rewriter/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, mail send actions, or existing design
system unless a future integration issue explicitly allows it.

## Contributor Setup

This folder ships a local architecture contract, deterministic services,
fixtures, tests, and hardening notes. Contributors should use these files as
the launch contract:

- `specs.md` defines the behavior and ownership boundary.
- `docs/architecture.md` defines internal module boundaries, data ownership,
  dependency rules, and future integration constraints.
- `services/emailToneRewriter.ts` implements the pure core rewrite engine.
- `services/guards.ts` implements the folder-local safety and performance
  guard layer.
- `services/fixtures.ts` provides deterministic synthetic requests.
- `tests/` contains executable unit coverage for the service and guards.
- `docs/test-plan.md` lists the acceptance scenarios future tests should cover.
- `docs/fixtures.md` describes synthetic rewrite requests and expected outputs.
- `docs/threat-model.md` documents security assumptions and unsafe inputs.
- `docs/performance.md` documents cost model and hard limits.
- `REVIEW_NOTES.md` gives reviewers a quick checklist for this isolated work.

## Intended Usage

The tool helps an individual user rewrite a draft email into a selected tone,
such as concise, friendly, formal, or apologetic. It accepts a draft, requested
tone, and optional constraints, then returns a reviewable rewrite without
sending, saving, or mutating mailbox state.

## Known Limitations

- Rewriting is deterministic and rule based; no external AI provider is called.
- The tool has no UI integration, route, persistence, mailbox connection, or
  send action.
- Main app routing, inbox integration, send actions, and persistence are
  intentionally out of scope until a future integration issue allows them.
