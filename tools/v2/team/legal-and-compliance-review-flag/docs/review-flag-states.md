# Review Flag: inputs, outputs, and states

This document describes the runtime states of the Legal & Compliance Review
Flag tool's non-UI contract (`createReviewFlag` / `createReviewFlagService`)
and the in-memory reference backend used for deterministic testing.

## Inputs

`ReviewFlagInput`:

- `reviewer` (string, required) — id of the actor raising the flag. Trimmed;
  non-empty and at most 128 characters.
- `targetResource` (string, required) — opaque id of the resource being
  flagged, e.g. `mail:thread:abc`. Trimmed; non-empty, at most 256 characters.
- `flagReason` (string, required) — human-readable rationale. Trimmed;
  non-empty, at most 2000 characters.
- `severity` — one of `low`, `medium`, `high`, `critical`.
- `evidenceRefs` (string[], optional) — up to 10 references, each at most 512
  characters.

## Output

On success the outcome is a `ReviewFlagResult`:

- `flagId` — id produced by the backend.
- `status` — always `open` for a newly created flag.
- `reviewState` — always `pending` for a newly created flag.
- `timestamp` — epoch-millisecond time the flag was created.
- `auditTrail` — append-only list describing what produced the flag.

## Loading / async states

Every dependency call (`resolveReviewer`, `resourceExists`,
`findExistingFlag`, `persistFlag`) may be synchronous or return a promise.
`createReviewFlag` awaits each one, so a caller should treat `raiseFlag` as
asynchronous and show a pending state until the returned promise settles. The
evaluation order is:

1. validate input
2. resolve reviewer authorization
3. check the resource exists
4. check for an existing open flag
5. generate id + timestamp and persist

The operation short-circuits at the first failing step.

## Error states

`createReviewFlag` never throws for expected domain failures. It resolves to a
`ReviewFlagError` with a stable `code`:

- `invalid_input` — one or more fields were missing or malformed (`fields`
  lists them).
- `unauthorized_reviewer` — the reviewer is not allowed to raise flags.
- `resource_not_found` — the target resource does not exist.
- `duplicate_flag` — an open flag already exists for the resource
  (`existingFlagId` points to it).
- `policy_conflict` — reserved for future policy checks.

Use `isReviewFlagError(outcome)` to narrow the result before reading either a
success or an error field.

## In-memory reference backend

`createInMemoryReviewFlagBackend` returns a `ReviewFlagBackend` implementation
that needs no database, network, or real clock:

- `authorizedReviewers` / `knownResources` — seed which reviewers and
  resources are recognized.
- `now` — inject a fixed clock (defaults to `DEFAULT_REVIEW_FLAG_TIMESTAMP`).
- `newId` — inject an id factory (defaults to a deterministic `flag:mem-<n>`
  counter).

Saved flags are held in memory keyed by `targetResource`, so a second flag on
the same resource surfaces as `duplicate_flag`. `listOpenFlags()` returns the
stored flags and `reset()` clears them between tests.

Example:

    const backend = createInMemoryReviewFlagBackend({
      authorizedReviewers: ["reviewer:legal-001"],
      knownResources: ["mail:thread:existing-abc"],
    });
    const service = createReviewFlagService(backend);
    const outcome = await service.raiseFlag({
      reviewer: "reviewer:legal-001",
      targetResource: "mail:thread:existing-abc",
      flagReason: "Possible spoofing of a regulated entity.",
      severity: "high",
    });
