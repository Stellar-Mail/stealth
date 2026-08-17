# Fixtures

Test fixtures and sample data for the PDF Summary Tool.

## Contents

- `sample-pdfs/` - Sample PDF files for testing
- `expected-summaries.json` - Expected summary outputs for different PDF types
- `mock-data.ts` - Mock objects and factories for tests

## Using Fixtures

### In Tests

```typescript
import { SAMPLE_PDF_PATH } from "../fixtures";
import { loadMockSummary } from "../fixtures/mock-data";

test("should summarize PDF", async () => {
  const file = new File([], "sample.pdf");
  const summary = await summarizePDF(file);
  expect(summary).toEqual(loadMockSummary("sample"));
});
```

## Guidelines

- ✅ Keep fixtures small and focused
- ✅ Use realistic sample data
- ✅ Document fixture purpose
- ✅ Version control fixtures
- ✅ Use factories for complex data

- ❌ Don't use actual user data
- ❌ Don't store large files
- ❌ Don't commit generated files (only templates)

## Adding New Fixtures

1. Create new file in `fixtures/`
2. Document what it's for
3. Use in tests
4. Commit to version control

Example: `fixtures/mock-data.ts`

```typescript
export const mockSummaries = {
  short: { id: '1', content: 'Brief summary...', ... },
  long: { id: '2', content: 'Detailed summary...', ... }
};

export function createMockSummary(overrides = {}) {
  return { id: '1', content: 'Summary', ...overrides };
}
```
