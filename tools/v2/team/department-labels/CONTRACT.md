# Department Labels Execution Contract

This is the stable, backend-facing contract for creating department labels.
It has no React, DOM, styling, routing, transport, or database dependency.

## Entry point

```ts
import {
  departmentLabelsService,
  createDepartmentLabelsService,
} from "./tools/v2/team/department-labels";

const result = await departmentLabelsService.execute(input);
```

The default service creates normalized department labels in memory. Applications
that need persistence construct a service with a `DepartmentLabelsRepository`:

```ts
const service = createDepartmentLabelsService({ repository });
const result = await service.execute(input);
```

The optional `generateId` and `now` dependencies make IDs and timestamps
replaceable for backend integrations and deterministic tests.

## Input: `DepartmentLabelsInput`

| Field           | Type                     | Required | Contract                                     |
| --------------- | ------------------------ | -------- | -------------------------------------------- |
| `createdBy`     | `string`                 | yes      | Non-empty creator identity.                  |
| `labels`        | `DepartmentLabelInput[]` | yes      | One or more labels, executed in array order. |
| `correlationId` | `string`                 | no       | Opaque value propagated to the output.       |

Each label accepts an optional `id`, a non-empty `name`, a non-empty
`departmentCode`, an optional hex `color` (defaults to `#3B82F6`), and an
optional `description`. Caller-supplied label IDs must be unique in the set.
Department codes must be unique across all labels.

## Output: `DepartmentLabelsResult`

The result is a discriminated union:

```ts
type DepartmentLabelsResult =
  | { ok: true; data: DepartmentLabels }
  | { ok: false; error: DepartmentLabelsError };
```

A successful `DepartmentLabels` contains a generated labels ID, normalized
input fields, an ISO-8601 `createdAt`, and ordered labels. Each label has an
ID, a zero-based `order`, a unique department code, and a resolved color.

Use `ok` to narrow the result. Error messages are diagnostic and may change;
consumers must use the stable `error.code` for control flow.

## Error codes

| Code                   | Meaning                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `INVALID_INPUT`        | A required scalar, label, or field value is missing or invalid.   |
| `DUPLICATE_LABEL_ID`   | Two labels use the same caller-supplied ID.                        |
| `DUPLICATE_DEPARTMENT` | Two labels use the same department code.                           |
| `INVALID_COLOR_FORMAT` | The color is not a valid hex color code (e.g., #FF5733).           |
| `PERSISTENCE_FAILED`   | The injected repository rejected or threw while saving.            |
| `INTERNAL_ERROR`       | An unexpected clock, ID generation, or execution failure occurred. |

Input-specific errors include a dot-path `field`, such as `labels.0.color`.

## Service boundary

The executor owns contract validation, normalization, label ordering, ID and
timestamp assignment, color defaulting, and mapping expected failures to typed
results.

The caller owns authentication and authorization, network transport, database
transactions, retries, presentation, and workflow execution after the labels are
created. Persistence is available only through the minimal
`DepartmentLabelsRepository.save(labels)` boundary. Expected failures are
returned, not thrown.

## Fixtures

`fixtures/execution.fixtures.ts` exports a successful three-label input plus
failure fixtures for empty labels, duplicate label IDs, duplicate department
codes, invalid color format, missing createdBy, missing label name, missing
department code, and a failing repository.
