# PDF Summary Tool - Module Boundaries

This document defines the internal contract for each module within the PDF Summary Tool.

## Module: Components

**Location:** `components/`

### Responsibility

Render the user interface for PDF summarization. Components are presentational and delegate all data fetching and processing to hooks and services.

### Public API

```typescript
// PDFUploadZone.tsx
export interface PDFUploadZoneProps {
  onPDFSelected: (file: File) => void;
  isProcessing: boolean;
  error?: string;
}
export const PDFUploadZone: React.FC<PDFUploadZoneProps>;

// SummaryDisplay.tsx
export interface SummaryDisplayProps {
  summary: Summary | null;
  isLoading: boolean;
  error?: string;
  onDownload: () => void;
  onCopy: () => void;
}
export const SummaryDisplay: React.FC<SummaryDisplayProps>;

// SummarySettings.tsx
export interface SummarySettingsProps {
  settings: SummarySettings;
  onSettingsChange: (settings: SummarySettings) => void;
}
export const SummarySettings: React.FC<SummarySettingsProps>;
```

### Dependencies

**Allowed to import:**

- Hooks from `hooks/`
- Types from `types/`
- Utils from `utils/`
- Radix UI (`@radix-ui/react-*`)
- React (`react`, `react-dom`)
- CSS files (local styles only)

**Forbidden:**

- Services (use hooks instead)
- Main app components or services
- Server APIs directly

### Patterns

- ✅ Use hooks for state and side effects
- ✅ Accept props for all configuration
- ✅ Emit events via callback props
- ✅ Import TypeScript types only from `types/`
- ❌ Don't call services directly
- ❌ Don't use global state
- ❌ Don't call localStorage directly

### Example

```typescript
// components/PDFUploadZone.tsx
import React from "react";
import { usePDFSummary } from "../hooks/usePDFSummary";
import type { PDFUploadZoneProps } from "../types";
import { validatePDFFile } from "../utils/pdfValidation";

export const PDFUploadZone: React.FC<PDFUploadZoneProps> = ({
  onPDFSelected,
  isProcessing,
  error,
}) => {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    const validation = validatePDFFile(file);
    if (validation.isValid) {
      onPDFSelected(file);
    }
  };

  return <div onDrop={handleDrop}>{/* JSX here */}</div>;
};
```

---

## Module: Services

**Location:** `services/`

### Responsibility

Implement business logic, data processing, and persistence. Services are stateless and provide a stable API to components via hooks.

### Public API

```typescript
// services/pdfProcessing.ts
export async function extractText(file: File): Promise<string>;
export function validatePDF(file: File): boolean;

// services/summarization.ts
export async function generateSummary(text: string, settings: SummarySettings): Promise<string>;

// services/storage.ts
export async function saveSummary(pdfId: string, summary: Summary): Promise<void>;
export async function getSummary(pdfId: string): Promise<Summary | null>;
export async function deleteSummary(pdfId: string): Promise<void>;
export async function listSummaries(): Promise<Summary[]>;
```

### Dependencies

**Allowed to import:**

- Types from `types/`
- Utils from `utils/`
- External libraries: PDF.js, native browser APIs
- Other services

**Forbidden:**

- React or React hooks
- Components
- Main app services
- Main app server APIs

### Patterns

- ✅ Export pure, stateless functions
- ✅ Accept parameters, return results
- ✅ Document async behavior
- ✅ Handle errors explicitly
- ✅ Use types from `types/`
- ❌ Don't use React hooks
- ❌ Don't maintain state
- ❌ Don't call component functions

### Data Storage Constraints

- Use `localStorage` with key prefix: `pdf-summary-tool:`
- Example: `pdf-summary-tool:summaries`
- All data must be JSON serializable
- Keep data structures flat (no deeply nested objects)
- Document all localStorage keys at module top

### Example

```typescript
// services/storage.ts
import type { Summary } from "../types";

const STORAGE_KEY = "pdf-summary-tool:summaries";

export async function saveSummary(pdfId: string, summary: Summary): Promise<void> {
  const summaries = await listSummaries();
  const updated = summaries.map((s) => (s.id === pdfId ? summary : s));
  if (!summaries.find((s) => s.id === pdfId)) {
    updated.push(summary);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export async function getSummary(pdfId: string): Promise<Summary | null> {
  const summaries = await listSummaries();
  return summaries.find((s) => s.id === pdfId) || null;
}
```

---

## Module: Hooks

**Location:** `hooks/`

### Responsibility

Manage component-level state and side effects. Hooks bridge components and services.

### Public API

```typescript
// hooks/usePDFSummary.ts
export function usePDFSummary(file: File | null): {
  summary: Summary | null;
  isLoading: boolean;
  error?: string;
};

// hooks/useSummarySettings.ts
export function useSummarySettings(): {
  settings: SummarySettings;
  updateSettings: (settings: SummarySettings) => void;
};

// hooks/useLocalSummaryStorage.ts
export function useLocalSummaryStorage(): {
  summaries: Summary[];
  saveSummary: (summary: Summary) => Promise<void>;
  deleteSummary: (id: string) => Promise<void>;
  isLoading: boolean;
};
```

### Dependencies

**Allowed to import:**

- React hooks
- Services from `services/`
- Types from `types/`
- Utils from `utils/`

**Forbidden:**

- Components
- Main app hooks
- Main app services

### Patterns

- ✅ Use React hooks only (useState, useEffect, useCallback, etc.)
- ✅ Call services to fetch/process data
- ✅ Manage component-level state
- ✅ Return objects with clear API
- ✅ Wrap async service calls
- ❌ Don't call other hooks directly (composition only)
- ❌ Don't import components

### Example

```typescript
// hooks/usePDFSummary.ts
import { useState, useEffect, useCallback } from "react";
import { extractText, generateSummary } from "../services/pdfProcessing";
import { saveSummary } from "../services/storage";
import { useSummarySettings } from "./useSummarySettings";
import type { Summary } from "../types";

export function usePDFSummary(file: File | null) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const { settings } = useSummarySettings();

  useEffect(() => {
    if (!file) return;

    (async () => {
      setIsLoading(true);
      try {
        const text = await extractText(file);
        const content = await generateSummary(text, settings);
        const newSummary: Summary = {
          id: Date.now().toString(),
          pdfId: file.name,
          content,
          settings,
          generatedAt: new Date(),
        };
        setSummary(newSummary);
        await saveSummary(file.name, newSummary);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [file, settings]);

  return { summary, isLoading, error };
}
```

---

## Module: Types

**Location:** `types/`

### Responsibility

Define TypeScript interfaces and types for the tool. No runtime code.

### Public API

```typescript
export interface PDF {
  id: string;
  name: string;
  size: number;
  uploadedAt: Date;
  content?: string;
}

export interface Summary {
  id: string;
  pdfId: string;
  content: string;
  settings: SummarySettings;
  generatedAt: Date;
}

export interface SummarySettings {
  length: "short" | "medium" | "long";
  style: "bullet-points" | "paragraph";
  includeKeywords: boolean;
  language: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}
```

### Constraints

- ❌ No runtime code
- ❌ No function implementations
- ❌ No imports from components or services
- ✅ Type definitions only
- ✅ Interfaces and types
- ✅ Comments and documentation

---

## Module: Utils

**Location:** `utils/`

### Responsibility

Provide pure utility functions for the tool. No side effects or state.

### Public API

```typescript
export function validatePDFFile(file: File): ValidationResult;
export function normalizeSummaryText(text: string): string;
export function extractKeywords(text: string, limit?: number): string[];
export function generatePDFId(file: File): string;
```

### Dependencies

**Allowed:**

- Types from `types/`
- Native browser APIs
- Pure npm packages

**Forbidden:**

- React
- Services
- Components
- Main app code

### Patterns

- ✅ Pure functions only
- ✅ No side effects
- ✅ No state
- ✅ Deterministic output
- ✅ Well-documented inputs/outputs
- ❌ No async code
- ❌ No external API calls
- ❌ No localStorage or DOM access

### Example

```typescript
// utils/pdfValidation.ts
import type { ValidationResult } from "../types";

export function validatePDFFile(file: File): ValidationResult {
  const MAX_SIZE_MB = 50;
  const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

  if (!file.type.includes("pdf")) {
    return { isValid: false, error: "File must be a PDF" };
  }

  if (file.size > MAX_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File must be smaller than ${MAX_SIZE_MB}MB`,
    };
  }

  return { isValid: true };
}
```

---

## Module: Tests

**Location:** `tests/`

### Structure

```
tests/
├── unit/
│   ├── services/
│   │   ├── pdfProcessing.spec.ts
│   │   ├── summarization.spec.ts
│   │   └── storage.spec.ts
│   ├── hooks/
│   │   ├── usePDFSummary.spec.ts
│   │   └── useSummarySettings.spec.ts
│   ├── utils/
│   │   ├── pdfValidation.spec.ts
│   │   └── textNormalization.spec.ts
│   └── components/
│       ├── PDFUploadZone.spec.tsx
│       └── SummaryDisplay.spec.tsx
├── integration/
│   └── pdf-summary-flow.spec.ts
└── README.md
```

### Patterns

- ✅ Test each module independently
- ✅ Use vitest for all tests
- ✅ Mock localStorage for storage tests
- ✅ Mock services for component tests
- ✅ Use fixtures from `fixtures/` folder
- ✅ Test happy path and error cases
- ❌ Don't import from main app
- ❌ Don't make real network calls

---

## Import Checklist

When adding new imports, verify:

- [ ] Import is from within tool boundary
- [ ] Module dependency graph is not violated
- [ ] No circular dependencies
- [ ] No imports from main app (`src/`)
- [ ] Types-only imports use `import type`

---

## Refactoring Guidelines

When refactoring modules:

1. **Don't break public APIs** - If external modules depend on it, discuss changes
2. **Keep isolation** - Don't move code outside the tool boundary
3. **Update tests** - Every refactor needs test updates
4. **Document changes** - Update README if module responsibility changes
5. **Review constraints** - Ensure constraints still hold after refactor

---

## Adding New Modules

If you need a new module:

1. Propose in PR/issue - explain why
2. Define responsibility clearly
3. Document in this file
4. Follow patterns of existing modules
5. Update ARCHITECTURE.md dependency graph
