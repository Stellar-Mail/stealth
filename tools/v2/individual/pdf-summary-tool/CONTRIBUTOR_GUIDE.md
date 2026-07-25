# PDF Summary Tool - Contributor Guide

Welcome, contributor! This guide explains how to work on the PDF Summary Tool while respecting its isolated architecture.

## Before You Start

### Read First

1. **[README.md](./README.md)** - Overview and quick start
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete architecture
3. **[INTEGRATION_CONSTRAINTS.md](./INTEGRATION_CONSTRAINTS.md)** - What you cannot do
4. **[MODULE_BOUNDARIES.md](./MODULE_BOUNDARIES.md)** - Module contracts
5. **[DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md)** - Data flow

### Key Principle

**This tool is self-contained.** All your work stays in `tools/v2/individual/pdf-summary-tool/`. You don't touch the main app.

---

## Setting Up Development

### Prerequisites

```bash
# Make sure Node.js is installed
node --version

# Navigate to workspace root
cd c:\Users\delig\stealth
```

### Install Dependencies

```bash
# Install all project dependencies (already includes PDF.js if needed)
npm install
```

### Development Commands

```bash
# Start dev server (for main app + all tools)
npm run dev

# Run tests (entire project)
npm test

# Run tests for just this tool
npm test tests/unit -- --grep "pdf-summary"

# Run E2E tests
npm run test:e2e

# Check linting
npm run lint

# Format code
npm run format
```

---

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/pdf-summary-tool/your-feature-name
```

### 2. Make Your Changes

All changes go in:

```
tools/v2/individual/pdf-summary-tool/
```

**Example structure:**

```
feature: Add keyword extraction to summaries

tools/v2/individual/pdf-summary-tool/
├── utils/
│   └── keywordExtraction.ts          ← NEW
├── tests/unit/
│   └── utils/
│       └── keywordExtraction.spec.ts ← NEW
├── types/
│   └── index.ts                      ← MODIFIED (add KeywordOptions type)
└── docs/
    └── API.md                        ← MODIFIED (document new function)
```

### 3. Follow the Module Pattern

#### Adding a Utility Function

```typescript
// utils/keywordExtraction.ts
/**
 * Extract keywords from text
 * @param text - Input text
 * @param limit - Maximum keywords to return (default 5)
 * @returns Array of keyword strings
 */
export function extractKeywords(text: string, limit: number = 5): string[] {
  // Implementation
  return keywords;
}

// ✅ Pure function
// ✅ No side effects
// ✅ Documented
// ❌ No React
// ❌ No async
// ❌ No imports from outside tool
```

#### Adding a Service Function

```typescript
// services/extraction.ts
import type { ExtractionResult } from "../types";
import { extractKeywords } from "../utils/keywordExtraction";

export async function extractSummaryKeywords(
  summary: string,
  options?: ExtractionOptions,
): Promise<string[]> {
  // Validation
  if (!summary?.trim()) {
    throw new Error("Summary text is required");
  }

  // Call utility
  const keywords = extractKeywords(summary, options?.limit);

  // Optional: Process further
  const filtered = keywords.filter((k) => k.length > 2);

  return filtered;
}

// ✅ Stateless function
// ✅ Calls utilities
// ✅ Returns typed result
// ✅ Handles errors
// ❌ No React
// ❌ No localStorage (unless service is storage)
// ❌ No component imports
```

#### Adding a Hook

```typescript
// hooks/useExtractedKeywords.ts
import { useState, useEffect } from "react";
import { extractSummaryKeywords } from "../services/extraction";
import type { ExtractionResult } from "../types";

export function useExtractedKeywords(summary: string | null) {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!summary) {
      setKeywords([]);
      return;
    }

    (async () => {
      setIsLoading(true);
      try {
        const extracted = await extractSummaryKeywords(summary);
        setKeywords(extracted);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [summary]);

  return { keywords, isLoading, error };
}

// ✅ Uses React hooks
// ✅ Calls services
// ✅ Returns hook API
// ✅ Handles async operations
// ❌ No other hook imports (composition only)
// ❌ No component JSX
```

#### Adding a Component

```typescript
// components/KeywordDisplay.tsx
import React from "react";
import { useExtractedKeywords } from "../hooks/useExtractedKeywords";
import type { KeywordDisplayProps } from "../types";

export const KeywordDisplay: React.FC<KeywordDisplayProps> = ({ summary, onKeywordClick }) => {
  const { keywords, isLoading, error } = useExtractedKeywords(summary);

  if (isLoading) return <div>Extracting keywords...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!keywords.length) return <div>No keywords found</div>;

  return (
    <div>
      {keywords.map((keyword) => (
        <button key={keyword} onClick={() => onKeywordClick?.(keyword)}>
          {keyword}
        </button>
      ))}
    </div>
  );
};

// ✅ React component
// ✅ Uses hooks
// ✅ Accepts props
// ✅ Emits events via callbacks
// ❌ No service calls (use hooks)
// ❌ No direct localStorage
```

### 4. Write Tests

#### Unit Test Example

```typescript
// tests/unit/utils/keywordExtraction.spec.ts
import { describe, it, expect } from "vitest";
import { extractKeywords } from "../../../utils/keywordExtraction";

describe("extractKeywords", () => {
  it("should extract keywords from text", () => {
    const text = "The quick brown fox jumps over the lazy dog";
    const keywords = extractKeywords(text);
    expect(keywords).toBeDefined();
    expect(keywords.length).toBeGreaterThan(0);
  });

  it("should respect limit parameter", () => {
    const text = "word1 word2 word3 word4 word5 word6";
    const keywords = extractKeywords(text, 3);
    expect(keywords.length).toBeLessThanOrEqual(3);
  });

  it("should handle empty text", () => {
    expect(() => extractKeywords("")).not.toThrow();
  });
});
```

#### Hook Test Example

```typescript
// tests/unit/hooks/useExtractedKeywords.spec.ts
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useExtractedKeywords } from "../../../hooks/useExtractedKeywords";

// Mock the service
vi.mock("../../../services/extraction", () => ({
  extractSummaryKeywords: vi.fn().mockResolvedValue(["keyword1", "keyword2"]),
}));

describe("useExtractedKeywords", () => {
  it("should extract keywords when summary is provided", async () => {
    const { result } = renderHook(() => useExtractedKeywords("Sample summary text"));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.keywords).toEqual(["keyword1", "keyword2"]);
  });

  it("should clear keywords when summary is null", () => {
    const { result } = renderHook(() => useExtractedKeywords(null));
    expect(result.current.keywords).toEqual([]);
  });
});
```

### 5. Update Documentation

#### Types Documentation

```typescript
// types/index.ts

/**
 * Options for keyword extraction
 */
export interface ExtractionOptions {
  /** Maximum number of keywords to extract */
  limit?: number;

  /** Filter out keywords shorter than this (chars) */
  minLength?: number;

  /** Filter out keywords from this list */
  stopWords?: string[];
}
```

#### API Documentation

````markdown
## API Reference

### extractKeywords(text: string, limit?: number): string[]

Extract keywords from text using simple frequency analysis.

**Parameters:**

- `text` (string): Input text to extract keywords from
- `limit` (number, optional): Maximum keywords to return (default: 5)

**Returns:** Array of keyword strings, sorted by frequency

**Example:**

```typescript
const keywords = extractKeywords("The quick brown fox", 3);
// ['quick', 'brown', 'fox']
```
````

**Throws:**

- Error if text is empty

````

### 6. Test Locally

```bash
# Run tests for changed modules
npm test tests/unit/utils/keywordExtraction.spec.ts

# Run all tool tests
npm test tests/unit -- --grep "pdf-summary"

# Check linting
npm run lint tools/v2/individual/pdf-summary-tool

# Format code
npm run format tools/v2/individual/pdf-summary-tool
````

### 7. Commit with Good Messages

```bash
# Good commit messages
git commit -m "feat: add keyword extraction to summaries"
git commit -m "test: add tests for keyword extraction"
git commit -m "docs: update API reference with keyword extraction"
git commit -m "refactor: simplify keyword filtering logic"

# Not so good
git commit -m "fix stuff"
git commit -m "update"
```

### 8. Push and Create PR

```bash
git push origin feature/pdf-summary-tool/your-feature-name
```

Then create a Pull Request with:

- **Title:** `[PDF Summary Tool] Your feature description`
- **Description:** Explain what you added and why
- **Checklist:**

```markdown
## Changes

- Added keyword extraction feature
- Added tests
- Updated documentation

## Verification

- [x] All tests pass locally
- [x] No linting errors
- [x] No modifications outside tool boundary
- [x] Documentation updated
- [x] Follows module patterns

## Files Changed

- `tools/v2/individual/pdf-summary-tool/utils/keywordExtraction.ts`
- `tools/v2/individual/pdf-summary-tool/tests/unit/utils/keywordExtraction.spec.ts`
- `tools/v2/individual/pdf-summary-tool/docs/API.md`
```

---

## Common Tasks

### Adding a New Component

```bash
# 1. Create component file
# tools/v2/individual/pdf-summary-tool/components/MyComponent.tsx

# 2. Create test file
# tools/v2/individual/pdf-summary-tool/tests/unit/components/MyComponent.spec.tsx

# 3. Add types to types/index.ts

# 4. Export from components/index.ts if needed
```

### Adding a New Service

```bash
# 1. Create service file
# tools/v2/individual/pdf-summary-tool/services/myService.ts

# 2. Create test file
# tools/v2/individual/pdf-summary-tool/tests/unit/services/myService.spec.ts

# 3. Add types to types/index.ts

# 4. Document in docs/API.md
```

### Adding a New Hook

```bash
# 1. Create hook file
# tools/v2/individual/pdf-summary-tool/hooks/useMyHook.ts

# 2. Create test file
# tools/v2/individual/pdf-summary-tool/tests/unit/hooks/useMyHook.spec.ts

# 3. Add return type to types/index.ts
```

### Running Specific Tests

```bash
# Test one file
npm test tests/unit/utils/myUtil.spec.ts

# Test with filter
npm test -- --grep "keyword extraction"

# Watch mode
npm test:watch tests/unit/utils/

# Coverage
npm test -- --coverage
```

---

## Code Style

### TypeScript

```typescript
// ✅ Prefer explicit types
const data: Summary[] = [];

// ✅ Use type imports for types only
import type { Summary } from "../types";

// ❌ Avoid any
let data: any;

// ❌ Avoid implicit any
const data = []; // should specify type
```

### React

```typescript
// ✅ Use functional components
export const MyComponent: React.FC<Props> = ({ prop1 }) => {};

// ✅ Use proper hook patterns
const [state, setState] = useState<StateType>();

// ❌ Don't use class components

// ❌ Don't call hooks conditionally
if (condition) {
  const [state] = useState(); // ❌ WRONG
}
```

### Naming

```typescript
// Components: PascalCase
export const PDFUploadZone = () => {};

// Functions: camelCase
export function extractKeywords() {}

// Constants: UPPER_SNAKE_CASE
const MAX_PDF_SIZE = 50 * 1024 * 1024;

// Types: PascalCase
export interface Summary {}
export type SummarySettings = "short" | "medium";
```

### Comments

```typescript
// ✅ Document public functions
/**
 * Extract text from PDF file
 * @param file - PDF file to process
 * @returns Extracted text content
 * @throws Error if PDF is invalid
 */
export async function extractText(file: File): Promise<string> {}

// ✅ Explain why, not what
// Use PDF.js because it handles encrypted PDFs better than alternatives
const parser = new pdfjsLib.PDFWorker();

// ❌ Don't explain obvious code
// Loop through summaries
for (const summary of summaries) {
}
```

---

## Debugging

### Using Console Logs

```typescript
// ✅ In development
if (process.env.NODE_ENV === "development") {
  console.log("Extracted text:", text);
}

// ✅ Temporary debugging
console.debug("Summary:", summary);

// ❌ Don't leave production console logs
console.log("User pressed button"); // Remove before commit
```

### Using Debugger

```typescript
// In component or service
debugger; // Browser will pause here when dev tools open

// Run: npm run dev
// Open browser dev tools (F12)
// Refresh page
// Step through code
```

### Checking localStorage

```typescript
// In browser console
localStorage.getItem("pdf-summary-tool:summaries");
localStorage.setItem("pdf-summary-tool:test", "value");
localStorage.removeItem("pdf-summary-tool:test");
localStorage.clear(); // WARNING: Clears all localStorage!
```

---

## Common Mistakes

### ❌ Mistake 1: Importing from Main App

```typescript
// WRONG
import { useMail } from "../../../src/features/mail/hooks";

// RIGHT
import { usePDFSummary } from "../hooks/usePDFSummary";
```

### ❌ Mistake 2: Calling Services Directly from Components

```typescript
// WRONG
export const MyComponent = () => {
  const [summary, setSummary] = useState();

  const handleClick = async () => {
    const summary = await generateSummary(text); // ❌ Direct service call
    setSummary(summary);
  };
};

// RIGHT
export const MyComponent = () => {
  const { summary } = usePDFSummary(file); // ✅ Use hook
};
```

### ❌ Mistake 3: Modifying Main App Files

```bash
# WRONG
echo "new data" >> ../../../src/services/mail.ts

# RIGHT
# Only modify files in tools/v2/individual/pdf-summary-tool/
```

### ❌ Mistake 4: Not Testing

```typescript
// WRONG
// Just write the code, ship it

// RIGHT
export function myFunction() {}

describe("myFunction", () => {
  it("should do X", () => {
    expect(myFunction()).toBe(expected);
  });
});
```

### ❌ Mistake 5: Circular Dependencies

```typescript
// WRONG - creates circular import
// services/myService.ts imports from hooks/
// hooks/myHook.ts imports from services/myService.ts

// RIGHT
// Keep dependency graph one-way
// Components → Hooks → Services → Utils
```

---

## Getting Help

### If You're Stuck

1. **Read the documentation:**

   - [ARCHITECTURE.md](./ARCHITECTURE.md) - Full architecture
   - [MODULE_BOUNDARIES.md](./MODULE_BOUNDARIES.md) - Module contracts
   - [INTEGRATION_CONSTRAINTS.md](./INTEGRATION_CONSTRAINTS.md) - Constraints

2. **Check existing patterns:**

   - Look at similar existing modules
   - Copy the pattern, adapt for your use case

3. **Search the codebase:**

   ```bash
   # Search for similar patterns
   grep -r "extractText" tools/v2/individual/pdf-summary-tool/
   ```

4. **Ask in PR/Issue:**
   - Comment with your question
   - Share code snippet
   - Describe what you're trying to do

---

## PR Review Checklist

Before submitting, check:

- [ ] All changes are in `tools/v2/individual/pdf-summary-tool/`
- [ ] No imports from `src/`
- [ ] Tests pass locally (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] Documentation is updated
- [ ] Module boundaries respected
- [ ] No circular dependencies
- [ ] Follows code style guide
- [ ] Commit messages are clear

If any fail, fix before creating PR.

---

## Questions?

Check the docs, read existing code, or ask in PR comments. Welcome aboard! 🎯
