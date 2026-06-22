# Collision Detection

Collision Detection is an isolated V1 team tool workspace for reviewing whether
a proposed outbound response duplicates work already present in a shared mailbox
thread. It is not wired into the main mail app yet.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/team/collision-detection/
```

Do not connect this tool to the app shell, dashboard navigation, inbox routing,
authentication, wallet code, Stellar integration, database schema, mail renderer,
or the shared design system unless a future integration issue explicitly allows
that work.

## Setup and Independent Review

This issue is documentation and test-planning focused. Reviewers can validate the
folder locally without booting the full mail app:

```bash
node -e "JSON.parse(require('fs').readFileSync('tools/v1/team/collision-detection/fixtures/collision-cases.json', 'utf8'))"
```

When executable tests are added in a later implementation issue, keep them under
this folder and run them with a folder-scoped command such as:

```bash
npx vitest run tools/v1/team/collision-detection/tests
```

## Usage Model

The future detector should accept one draft reply plus prior team responses for
the same thread, then return one of the outcomes documented in `specs.md`.
Reviewers can use `fixtures/collision-cases.json` as the first usage contract:

- load a fixture case,
- compare `draftReply.body` with `priorResponses[].body`,
- classify the case as `duplicate`, `possible_duplicate`, `distinct`, or
  `invalid_input`,
- keep any UI or mailbox integration as follow-up work.

## Review Map

- `specs.md` defines the expected input model, outcomes, and boundaries.
- `fixtures/collision-cases.json` provides synthetic duplicate, possible
  duplicate, distinct, and invalid-input cases.
- `tests/test-plan.md` documents review scenarios until executable tests exist.
- `docs/review-notes.md` gives maintainers a folder-local review checklist.
- `docs/validation-notes.md` records what can be validated before integration.

## Intended Behavior

The tool should help reviewers classify a draft reply against prior team
responses in the same conversation:

- `duplicate` when the draft materially repeats an existing response.
- `possible_duplicate` when the draft overlaps enough to require human review.
- `distinct` when the draft covers a separate request or materially different
  answer.
- `invalid_input` when required draft or thread context is missing.

## Known Limitations

- This folder does not contain a production detector service yet.
- The fixtures are synthetic and do not represent live mailbox data.
- There is no persistence, authorization model, or app integration in this
  issue.
- Human review is still required for borderline semantic matches.
