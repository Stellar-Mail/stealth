# Escalation Tool Execution Contract

This document defines the stable, presentation-independent execution contract for the Escalation Tool.
It has no React, DOM, styling, routing, transport, or database dependency.

## Entry Point

```ts
import {
  escalationToolService,
  createEscalationToolService,
} from "./tools/v2/team/escalation-tool";

const result = await escalationToolService.execute(input);
```

The default `escalationToolService` processes escalations in memory. Applications requiring persistence supply an `EscalationRepository`:

```ts
const service = createEscalationToolService({ repository });
const result = await service.execute(input);
```

Injectable `generateId` and `now` dependencies allow deterministic testing and clock control for backend integration.

## Input: `EscalationInput`

| Field              | Type                 | Required | Description                                                              |
| ------------------ | -------------------- | -------- | ------------------------------------------------------------------------ |
| `conversationId`   | `string`             | yes      | Non-empty ID of the conversation being escalated.                        |
| `reason`           | `string`             | yes      | Non-empty explanation for the escalation request.                        |
| `priority`         | `EscalationPriority` | yes      | Priority level: `"low" \| "medium" \| "high" \| "urgent"`.               |
| `requestedBy`      | `string`             | yes      | Non-empty identity of the actor initiating the escalation.               |
| `targetDepartment` | `string`             | no       | Target department or group (defaults to `"general-support"` if omitted). |
| `notes`            | `string`             | no       | Additional notes or context.                                             |
| `correlationId`    | `string`             | no       | Opaque value propagated to the output record.                            |

## Output: `EscalationToolResult`

The result is a discriminated union:

```ts
type EscalationToolResult =
  { ok: true; data: EscalationRecord } | { ok: false; error: EscalationError };
```

A successful `EscalationRecord` contains:

- `id`: `string` (generated unique record ID)
- `conversationId`: `string`
- `reason`: `string`
- `priority`: `EscalationPriority`
- `requestedBy`: `string`
- `targetDepartment`: `string`
- `status`: `"open" | "in_review" | "resolved" | "dismissed"` (defaults to `"open"`)
- `createdAt`: `string` (ISO-8601 timestamp)
- `notes`?: `string`
- `correlationId`?: `string`

Consumers must use `result.ok` to narrow the result.

## Error Codes

| Code                 | Meaning                                                                     |
| -------------------- | --------------------------------------------------------------------------- |
| `INVALID_INPUT`      | A required string input is missing or empty.                                |
| `INVALID_PRIORITY`   | The priority value is not one of `"low" \| "medium" \| "high" \| "urgent"`. |
| `PERSISTENCE_FAILED` | The injected repository threw an error while saving.                        |
| `INTERNAL_ERROR`     | An unexpected execution error occurred.                                     |

Input validation errors include a `field` dot-path attribute (e.g. `conversationId`).

## Service Boundary

- **Executor owns**: Input validation, payload normalization, timestamp and ID assignment, and mapping errors to typed results.
- **Caller owns**: Authentication, authorization, routing, database transactions, UI rendering, and downstream workflow execution.

## Fixtures

`fixtures/execution.fixtures.ts` exports:

- `successfulEscalationInput`: Valid input fixture
- `missingConversationIdInput`: Invalid conversationId failure fixture
- `missingReasonInput`: Invalid reason failure fixture
- `invalidPriorityInput`: Invalid priority failure fixture
- `failingRepository`: Mock repository simulating persistence failure
