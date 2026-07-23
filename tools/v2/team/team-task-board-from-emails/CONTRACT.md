# Team Task Board from Emails - Execution Contract

This document defines the **backend-facing, presentation-independent execution
contract** for the Team Task Board from Emails tool. It is intended for APIs,
schedulers, inbox jobs, tests, and future automation. It deliberately contains
no UI, styling, or layout concerns.

> Scope note: This contract operates on local data and the folder's extraction
> heuristic. It does not wire into the main app, routing, inbox architecture,
> auth, wallet, Stellar, or any database. Those are out of scope (see
> `README.md` and `docs/architecture.md`).

## Service Entry Point

The contract is executed through a single, non-UI service entry point:

```ts
import { taskBoardExecutor } from "./services/task-board-execution.service.mjs";
// or construct your own with dependency injection:
import { createTaskBoardExecutor } from "./services/task-board-execution.service.mjs";

const result = taskBoardExecutor.createTaskFromEmail({ email, context });
```

`createTaskBoardExecutor({ extract })` returns `{ createTaskFromEmail, extractTaskFromEmail, groupTasksByStatus }`. It is dependency-injected: pass a custom `extract` function to swap the heuristic for tests/automation. The singleton `taskBoardExecutor` is pre-bound to the built-in extraction logic.

The executor **never throws** for expected failures. Every outcome is returned
as a typed `TaskBoardResult`. Only genuinely unexpected extraction failures
surface as `INTERNAL_ERROR`.

## Input Schema (`CreateTaskInput`)

| Field     | Type                | Required | Behavior                                                                                                    |
| --------- | ------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| `email`   | `EmailInput`        | yes      | The source email to convert. Must satisfy the email contract (see below).                                   |
| `context` | `TaskBoardContext?` | no       | Security context. Omitting it enables local/demo mode (no authorization). When present, policy is enforced. |

### `EmailInput`

| Field        | Type       | Required | Behavior                                        |
| ------------ | ---------- | -------- | ----------------------------------------------- |
| `id`         | `string`   | yes      | Stable email identifier. Non-empty.             |
| `threadId`   | `string`   | yes      | Thread the email belongs to. Non-empty.         |
| `from`       | `string`   | yes      | Sender address. Non-empty.                      |
| `to`         | `string[]` | yes      | Recipient addresses. Must be an array.          |
| `subject`    | `string`   | yes      | Email subject. Non-empty (may be `""`).         |
| `receivedAt` | `string`   | yes      | ISO-8601 date-time. Must parse to a valid date. |
| `body`       | `string`   | yes      | Email body text. Non-empty (may be `""`).       |
| `signals?`   | `string[]` | no       | Optional upstream NLP/heuristics hints.         |

### `TaskBoardContext`

| Field          | Type        | Required | Behavior                                                              |
| -------------- | ----------- | -------- | --------------------------------------------------------------------- |
| `requesterId`  | `string`    | yes      | Identity of the caller performing extraction. Non-empty.              |
| `role`         | `string`    | yes      | Role used for policy evaluation (e.g. `agent`, `manager`). Non-empty. |
| `allowedRoles` | `string[]?` | no       | Roles permitted to extract. Defaults to `["agent","manager"]`.        |

## Output Schema (`TaskBoardResult`)

```ts
interface TaskBoardResult {
  ok: boolean;
  data?: TaskCard; // present when ok === true
  error?: TaskBoardErrorPayload; // present when ok === false
}
```

### `TaskCard` (output)

| Field            | Type                                       | Description                                                   |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------- |
| `id`             | `string`                                   | Stable task id derived from `email.id` (`email-` → `task-`).  |
| `title`          | `string`                                   | Short action label extracted from the email.                  |
| `owner`          | `string`                                   | `Ops` \| `Legal` \| `Support` \| `Finance` \| `"unassigned"`. |
| `dueDate`        | `string \| null`                           | ISO date (`YYYY-MM-DD`) or `null` when undetermined.          |
| `priority`       | `"low" \| "medium" \| "high"`              | Relative urgency.                                             |
| `status`         | `"new" \| "triage" \| "blocked" \| "done"` | Board column.                                                 |
| `sourceEmailId`  | `string`                                   | Identifier of the source email.                               |
| `reviewRequired` | `boolean`                                  | True when `status === "blocked"` or `owner === "unassigned"`. |

### `TaskBoardErrorPayload`

| Field     | Type                 | Description                                                     |
| --------- | -------------------- | --------------------------------------------------------------- |
| `code`    | `TaskBoardErrorCode` | Stable, typed error code. **Branch on this, not on `message`.** |
| `message` | `string`             | Human-readable text. Not stable across versions.                |
| `field`   | `string?`            | Offending field, present only for `MALFORMED_EMAIL`.            |

## Error Codes

| Code              | Meaning                                         | Trigger                                                                                                                                  |
| ----------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `INVALID_INPUT`   | Top-level input shape was wrong.                | `input` not an object, or `context` malformed (missing `requesterId`/`role`).                                                            |
| `INVALID_EMAIL`   | The `email` field was missing or not an object. | `input.email` absent or wrong type.                                                                                                      |
| `MALFORMED_EMAIL` | A required email field failed validation.       | Empty/non-string `id`/`threadId`/`from`/`subject`/`receivedAt`/`body`; `to` not an array; or invalid `receivedAt` date. Carries `field`. |
| `UNAUTHORIZED`    | Caller role is not permitted to extract tasks.  | `context.role` not in `allowedRoles`.                                                                                                    |
| `INTERNAL_ERROR`  | Unexpected execution failure.                   | Any thrown error inside the extraction layer (e.g. datastore outage).                                                                    |

Consumers MUST NOT branch on `error.message`. Treat `message` as log-only.

## Execution Flow

```
createTaskFromEmail(input)
  │
  ├─ validateCreateTaskInput(input)
  │     └─ invalid → { ok:false, INVALID_INPUT | INVALID_EMAIL }
  │
  ├─ validateEmail(input.email)
  │     └─ invalid → { ok:false, MALFORMED_EMAIL, field }
  │
  ├─ isAuthorized(input.context)
  │     └─ context present & role not allowed → { ok:false, UNAUTHORIZED }
  │
  ├─ extract(input.email)   ← deterministic heuristics
  │
  └─ { ok:true, data: TaskCard }
```

Any thrown error anywhere in the flow is caught and returned as
`{ ok:false, INTERNAL_ERROR }` — the executor never throws for handled paths.

## Service Boundaries

- **In scope:** input validation, authorization policy, email→task extraction,
  and the typed result envelope.
- **Out of scope:** UI rendering, React state, DOM/localStorage, network/API
  transport, inbox ingestion, wallet/Stellar, persistence backends, and
  notification side effects. Those belong to the caller or a later integration
  phase.
- The executor depends only on the `extract` injection (defaulting to the
  built-in heuristic), so it can be pointed at a custom classifier in tests
  without code changes.

## Fixtures

Presentation-independent fixtures live in `fixtures/` and cover:

- `sample-task-emails-contract.json` — successful email→task conversion
  (four board statuses, mirrors `sample-task-emails.json`).
- `invalid-task-board-data.json` — `INVALID_INPUT`, `MALFORMED_EMAIL`
  (with offending `field`), and `UNAUTHORIZED` cases.
- Internal failure is exercised in tests via an injected throwing `extract`.

## Extension Guidance (for future contributors)

1. **Add a field:** extend `EmailInput`/`TaskCard` in
   `contract/task-board-contract.d.ts`, update the `.mjs` extraction, and
   document it in this file. Keep UI types (`types.ts`) separate from the
   contract.
2. **Add an error code:** add it to `TaskBoardErrorCode` in
   `guards/task-board-errors.mjs`, handle it in `task-board-guards.mjs` or the
   executor, and add a row to the error-code table above. Never return free-form
   error strings as a code.
3. **Change authorization rules:** adjust `isAuthorized()` /
   `DEFAULT_ALLOWED_ROLES` or pass `allowedRoles` via `context`. Do not hardcode
   role checks at call sites.
4. **Swap the heuristic:** pass `createTaskBoardExecutor({ extract })` in tests
   or automation. No changes to the contract or executor shell are required.
5. **Keep it backend-facing:** do not import React, DOM, or rendering
   primitives into `task-board-execution.service.mjs` or
   `contract/task-board-contract.d.ts`. UI lives in `components/`; business
   logic stays in `services/`.

## Testing

Run the contract tests with Node's built-in runner (no build step):

```bash
node --test tools/v2/team/team-task-board-from-emails/tests/task-board-contract.test.mjs
```

These mirror `tests/task-board-fixtures.test.mjs` and validate the success path,
malformed/invalid inputs, authorization, and the internal-failure envelope.
