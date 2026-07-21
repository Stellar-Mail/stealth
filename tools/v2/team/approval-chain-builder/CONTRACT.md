# Approval Chain Builder Execution Contract

This is the stable, backend-facing contract for constructing an approval chain.
It has no React, DOM, styling, routing, transport, or database dependency.

## Entry point

```ts
import {
  approvalChainBuilderService,
  createApprovalChainBuilderService,
} from "./tools/v2/team/approval-chain-builder";

const result = await approvalChainBuilderService.execute(input);
```

The default service creates a normalized draft chain in memory. Applications
that need persistence construct a service with an `ApprovalChainRepository`:

```ts
const service = createApprovalChainBuilderService({ repository });
const result = await service.execute(input);
```

The optional `generateId` and `now` dependencies make IDs and timestamps
replaceable for backend integrations and deterministic tests.

## Input: `ApprovalChainBuilderInput`

| Field           | Type                   | Required | Contract                                     |
| --------------- | ---------------------- | -------- | -------------------------------------------- |
| `subjectId`     | `string`               | yes      | Non-empty id of the object being approved.   |
| `subjectType`   | `string`               | yes      | Non-empty category such as `invoice`.        |
| `name`          | `string`               | yes      | Non-empty chain name.                        |
| `createdBy`     | `string`               | yes      | Non-empty creator identity.                  |
| `stages`        | `ApprovalStageInput[]` | yes      | One or more stages, executed in array order. |
| `correlationId` | `string`               | no       | Opaque value propagated to the output.       |

Each stage accepts an optional `id`, a non-empty `name`, one or more unique
`approverIds`, and an optional integer `requiredApprovals`. When the threshold
is omitted it defaults to the number of approvers. It must be between one and
the number of approvers. Caller-supplied stage IDs must be unique in the chain.

## Output: `ApprovalChainBuilderResult`

The result is a discriminated union:

```ts
type ApprovalChainBuilderResult =
  | { ok: true; data: ApprovalChain }
  | { ok: false; error: ApprovalChainError };
```

A successful `ApprovalChain` contains a generated chain ID, normalized input
fields, an ISO-8601 `createdAt`, `status: "draft"`, and ordered stages. Each
stage has an ID, a zero-based `order`, unique approver IDs, and a resolved
approval threshold.

Use `ok` to narrow the result. Error messages are diagnostic and may change;
consumers must use the stable `error.code` for control flow.

## Error codes

| Code                         | Meaning                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `INVALID_INPUT`              | A required scalar, stage, or approver value is missing or invalid. |
| `DUPLICATE_STAGE_ID`         | Two stages use the same caller-supplied ID.                        |
| `DUPLICATE_APPROVER`         | An approver occurs more than once in one stage.                    |
| `INVALID_APPROVAL_THRESHOLD` | The threshold is not an integer in the allowed range.              |
| `PERSISTENCE_FAILED`         | The injected repository rejected or threw while saving.            |
| `INTERNAL_ERROR`             | An unexpected clock, ID generation, or execution failure occurred. |

Input-specific errors include a dot-path `field`, such as
`stages.0.requiredApprovals`.

## Service boundary

The executor owns contract validation, normalization, stage ordering, ID and
timestamp assignment, and mapping expected failures to typed results.

The caller owns authentication and authorization, network transport, database
transactions, retries, presentation, and workflow execution after the draft is
created. Persistence is available only through the minimal
`ApprovalChainRepository.save(chain)` boundary. Expected failures are returned,
not thrown.

## Fixtures

`fixtures/execution.fixtures.ts` exports a successful two-stage input plus
failure fixtures for empty stages, duplicate approvers, duplicate stage IDs,
an invalid threshold, and a failing repository.
