# Team Inbox Rules Builder Execution Contract

This module exposes a backend-facing rules execution boundary with no React,
DOM, styling, or layout dependency.

## Entry points

- `teamInboxRulesExecutor.execute(input)` is the ready-to-use service entry
  point backed by `RuleEngineService`.
- `createTeamInboxRulesExecutor({ evaluator })` creates an executor with an
  injected evaluator for backend adapters, tests, and automation.
- Both are exported from the tool's root `index.ts`.

## Input

`TeamInboxRulesExecutionInput` contains:

- `mail`: a complete `MailContext` to evaluate.
- `rules`: an array of `InboxRule` values. Disabled rules are ignored. An empty
  array is valid and produces a successful result with zero evaluations.

Runtime validation protects JavaScript, JSON, and other untyped callers.
Executable rules must have a non-empty ID and name, an enabled flag, at least
one condition group, and at least one action.

## Output

`TeamInboxRulesExecutionResult` is a discriminated union:

- `{ ok: true, data }` returns evaluation counts, each rule result, and a
  flattened list of triggered actions paired with their rule IDs.
- `{ ok: false, error }` returns a stable code, human-readable message, and an
  optional field path. Expected failures are returned and are not thrown.

Consumers must branch on `error.code`, never on `error.message`.

## Error codes

| Code               | Meaning                                                |
| ------------------ | ------------------------------------------------------ |
| `INVALID_INPUT`    | The execution envelope or rules collection is invalid. |
| `INVALID_MAIL`     | A required mail field is missing or malformed.         |
| `INVALID_RULE`     | A rule cannot be safely evaluated.                     |
| `EXECUTION_FAILED` | The injected evaluator failed unexpectedly.            |

## Service boundary

The executor depends only on `TeamInboxRulesEvaluator`, whose single method is
`evaluateAll(rules, mail)`. This keeps orchestration independent from storage
and presentation, while allowing the existing rules engine or a backend
implementation to be supplied.
