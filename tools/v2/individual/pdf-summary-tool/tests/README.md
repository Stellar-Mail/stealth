# Tests

Test suite for the PDF Summary Tool.

## Structure

```
tests/
├── unit/
│   ├── services/       # Service function tests
│   ├── hooks/          # Hook tests
│   ├── utils/          # Utility function tests
│   └── components/     # Component tests
├── integration/        # Multi-module integration tests
└── e2e/               # End-to-end tests (future)
```

## Running Tests

```bash
# All tests
npm test

# Just unit tests
npm test tests/unit

# Watch mode
npm test:watch tests/unit

# Specific file
npm test tests/unit/utils/pdfValidation.spec.ts

# With filter
npm test -- --grep "keyword extraction"
```

## Test Patterns

### Unit Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { myFunction } from "../../../utils/myUtil";

describe("myFunction", () => {
  it("should do X", () => {
    const result = myFunction(input);
    expect(result).toBe(expected);
  });

  it("should handle error case", () => {
    expect(() => myFunction(invalidInput)).toThrow();
  });
});
```

### Hook Test Template

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { useMyHook } from "../../../hooks/useMyHook";

describe("useMyHook", () => {
  it("should load data", async () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeDefined();
  });
});
```

### Component Test Template

```typescript
import { render, screen } from '@testing-library/react';
import { MyComponent } from '../../../components/MyComponent';

describe('MyComponent', () => {
  it('should render', () => {
    render(<MyComponent />);
    expect(screen.getByText(/expected text/i)).toBeInTheDocument();
  });
});
```

## Guidelines

- ✅ Test happy path and error cases
- ✅ Test edge cases
- ✅ Mock external dependencies
- ✅ Use descriptive test names
- ✅ Keep tests focused and independent
- ✅ Use fixtures from `../fixtures/`

- ❌ Don't test implementation details
- ❌ Don't import from main app in tests
- ❌ Don't make real API calls
- ❌ Don't access real localStorage (mock it)

## Mocking

### Mock localStorage

```typescript
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", { value: mockLocalStorage });
```

### Mock Services

```typescript
import { vi } from "vitest";
vi.mock("../../../services/myService", () => ({
  myFunction: vi.fn().mockResolvedValue({ success: true }),
}));
```

See [../CONTRIBUTOR_GUIDE.md](../CONTRIBUTOR_GUIDE.md#writing-tests) for more examples.
