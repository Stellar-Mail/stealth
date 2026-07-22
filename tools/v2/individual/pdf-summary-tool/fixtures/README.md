# Fixtures

Test fixtures, typed execution contract, and sample data for the PDF Summary Tool.

## Execution Contract

The fixtures module exposes a **non-UI service entry point** that can run independently of any presentation layer.

### Entry Point

```typescript
import { FixtureExecutionService, FixtureAction } from "../fixtures";

const service = new FixtureExecutionService();
const result = await service.execute({
  action: FixtureAction.GENERATE_SUMMARY,
  payload: {
    text: "Extracted PDF text…",
    settings: { length: "short", style: "bullet-points", includeKeywords: false, language: "en" },
  },
});

if (result.success) {
  console.log(result.data); // Summary object
} else {
  console.error(result.error); // { code, message }
}
```

### Actions

| Action              | Payload                                        | Success Data        |
| ------------------- | ---------------------------------------------- | ------------------- |
| `GENERATE_SUMMARY`  | `{ text: string, settings: SummarySettings }`  | `Summary`           |
| `VALIDATE_PDF`      | `{ fileName, fileSizeBytes, mimeType }`        | `{ valid: boolean }`|
| `GET_SETTINGS`      | _(none)_                                       | `SummarySettings`   |

### Error Codes

| Code                   | When                                          |
| ---------------------- | --------------------------------------------- |
| `INVALID_INPUT`        | Missing or malformed action / payload         |
| `FILE_TOO_LARGE`       | File exceeds 50 MB limit                      |
| `UNSUPPORTED_FORMAT`   | MIME type is not `application/pdf`            |
| `EXTRACTION_FAILED`    | Text content is empty                         |
| `SUMMARIZATION_FAILED` | Summary generation fails                      |
| `ACTION_NOT_SUPPORTED` | Unknown action string                         |
| `INTERNAL_ERROR`       | Unexpected runtime error                      |

## Contents

| File                      | Purpose                                     |
| ------------------------- | ------------------------------------------- |
| `execution.types.ts`      | Typed input/output contract & error codes   |
| `execution.service.ts`    | Stateless service entry point               |
| `execution.fixtures.ts`   | Success & failure fixture pairs for tests   |
| `index.ts`                | Barrel export                               |

## Using Fixtures in Tests

```typescript
import { describe, it, expect } from "vitest";
import { FixtureExecutionService, SUCCESS_FIXTURES, FAILURE_FIXTURES } from "../fixtures";

const service = new FixtureExecutionService();

describe("success cases", () => {
  SUCCESS_FIXTURES.forEach(({ label, input, expectedOutput }) => {
    it(label, async () => {
      const result = await service.execute(input);
      expect(result.success).toBe(expectedOutput.success);
      if (expectedOutput.hasData) {
        expect(result.data).toBeDefined();
      }
    });
  });
});

describe("failure cases", () => {
  FAILURE_FIXTURES.forEach(({ label, input, expectedOutput }) => {
    it(label, async () => {
      const result = await service.execute(input);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(expectedOutput.error?.code);
    });
  });
});
```

## Guidelines

- ✅ Keep fixtures small and focused
- ✅ Use realistic sample data
- ✅ Document fixture purpose
- ✅ Version control fixtures
- ✅ Use factories for complex data
- ✅ Type all fixture data against the execution contract

- ❌ Don't use actual user data
- ❌ Don't store large files
- ❌ Don't commit generated files (only templates)

## Adding New Fixtures

1. Add the new action to `FixtureAction` in `execution.types.ts`
2. Define the payload type
3. Implement the handler in `execution.service.ts`
4. Add success and failure entries in `execution.fixtures.ts`
5. Export via `index.ts`
6. Tests will pick up the new fixture automatically
