# Team Digest Generator — Non-UI Test Execution Contract (#1352)

This document defines the presentation-free execution contract and service boundary for testing and headless integration of `tools/v2/team/team-digest-generator` and its tests (`tools/v2/team/team-digest-generator/tests`).

## 1. Overview & Service Boundary

The test execution contract provides a stable, backend-facing interface (`ITestDigestExecutionService`) that decouples test harnesses and headless automation from any UI, React, or DOM dependencies.

### Key Entry Points

- **Factory Function**: `createTestDigestExecutionService(): ITestDigestExecutionService`
- **Class Implementation**: `TestDigestExecutionService`
- **Module Exports**: Available from both `tools/v2/team/team-digest-generator/tests/index` and root `tools/v2/team/team-digest-generator/index`.

---

## 2. Typed Input & Output DTOs

### Discriminated Result Union

Every contract operation returns a typed `TestDigestResult<T>` envelope instead of throwing unhandled exceptions:

```ts
export type TestDigestResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      error: TestDigestErrorCode;
      message: string;
      details?: unknown;
    };
```

### Supported Operations (`TestDigestOperation`)

- **`generate_from_items`**: Generates a summary (`TeamDigestSummary`) from `TeamDigestItem[]` with optional `topSubjectLimit`.
- **`generate_from_activity`**: Generates a structured activity digest (`GeneratedActivityDigest`) from `ActivityItem[]` with optional reference date and timestamp.
- **`validate_email`**: Validates an email string against format and injection rules (`{ valid: boolean; error?: ValidationError }`).
- **`sanitize_content`**: Strips dangerous HTML tags, protocols, event handlers, and control characters (`{ sanitizedHtml: string; sanitizedSubject?: string }`).

---

## 3. Explicit Error Codes (`TestDigestErrorCode`)

| Error Code            | Description                                                                          |
| :-------------------- | :----------------------------------------------------------------------------------- |
| `INVALID_INPUT`       | Required fields missing or malformed (e.g., non-array payload or missing author ID). |
| `VALIDATION_FAILED`   | Input validation failed against domain schema rules.                                 |
| `SANITIZATION_FAILED` | Sanitization engine encountered unprocessable input.                                 |
| `EXECUTION_FAILED`    | Unexpected error or failure during aggregation or processing.                        |
| `UNKNOWN_OPERATION`   | The requested operation type is not supported by the contract.                       |

---

## 4. Test Fixtures

Deterministic success and failure fixtures are exported from `./tests/execution-contract.fixtures.ts` (and re-exported by `tests/index.ts` and `index.ts`):

### Success Fixtures

- **`VALID_ITEMS_FIXTURE`**: Sample `TeamDigestItem[]` with 2 valid activity items.
- **`VALID_ACTIVITY_FIXTURE`**: Sample `ActivityItem[]` with valid email activity signals.
- **`VALID_EMAIL_FIXTURE`**: `"developer@example.com"`.
- **`VALID_SANITIZE_FIXTURE`**: HTML string with XSS and script tags that are stripped cleanly.

### Failure Fixtures

- **`INVALID_ITEMS_MISSING_AUTHOR`**: Sample item missing required author attribute.
- **`INVALID_ACTIVITY_NOT_ARRAY`**: Non-array payload for testing input rejection.
- **`INVALID_EMAIL_FIXTURE`**: Malformed email containing SQL injection characters (`"admin'--@example.com"`).
- **`INVALID_OPERATION_FIXTURE`**: Unsupported operation type object.

---

## 5. Usage Example

```ts
import {
  createTestDigestExecutionService,
  VALID_ITEMS_FIXTURE,
} from "tools/v2/team/team-digest-generator";

const service = createTestDigestExecutionService();
const result = service.execute({
  type: "generate_from_items",
  items: VALID_ITEMS_FIXTURE,
});

if (result.ok) {
  console.log("Total items:", result.value.summary.totalItems);
} else {
  console.error("Execution failed:", result.error, result.message);
}
```
