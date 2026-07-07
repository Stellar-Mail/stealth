# Draft Improver Core Contract

This document describes the folder-local Draft Improver engine added for the
core feature issue. It is deterministic and does not call an LLM, live mailbox,
remote API, database, wallet, or production service.

## Inputs

`improveDraft(request, options)` accepts a plain object with:

- `id`: stable local request identifier.
- `subject`: optional draft subject.
- `body`: required draft body.
- `goal`: one of `clarity`, `concise`, `friendly`, `professional`, or
  `call-to-action`.
- `audience`: optional recipient name used for a safe greeting.
- `senderName`: optional sender name used for a safe signoff.
- `deadline`: optional text used only when adding a call to action.
- `context`: optional reviewer context clipped to the local limit.
- `channel`: optional channel label, defaulting to `email`.

`options.now` fixes the generated timestamp for deterministic tests.
`options.limits` can override local subject, body, and context clipping limits.

## Outputs

Successful calls return:

- `status: "ready"`
- `isLoading: false`
- `error: null`
- `result.input`: normalized copy of the accepted request.
- `result.output`: improved `subject`, improved `body`, and a short `preview`.
- `result.issues`: issues detected before improvement.
- `result.remainingIssues`: issues still needing reviewer attention.
- `result.changes`: reviewable change records grouped by type.
- `result.warnings`: clipping warnings for oversized local input.
- `result.metrics`: word counts, reduction percentage, reading time, and issue
  count.
- `result.reviewRequired`: true when a medium severity issue remains.

## Loading State

`createDraftImproverLoadingState(message)` returns the shape future UI work can
render before a local improvement run finishes:

- `status: "loading"`
- `isLoading: true`
- `error: null`
- `result: null`
- `message`: reviewer-facing progress text.

## Error State

Invalid requests do not throw. They return:

- `status: "error"`
- `isLoading: false`
- `error.code: "draft-improver-error"`
- `error.messages`: validation messages.
- `result: null`
- `requestId`: the local request id when available.

The validator rejects empty bodies and active markup such as script tags or
`javascript:` URLs. This keeps the core engine reviewable without overlapping
the future app shell, routing, mail rendering, wallet, Stellar, or database
integration work.

## Local Review Command

Run from the repository root:

```bash
node --test tools/v2/individual/draft-improver/tests/draft-improver-core.test.mjs
```
