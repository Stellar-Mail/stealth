# PDF Summary Tool - Architecture Contract

## Overview

The PDF Summary Tool is a self-contained, isolated mini-product that enables users to automatically generate summaries of PDF attachments in their mail. This tool operates entirely within its own folder boundary and has zero dependencies on the main application architecture.

**Release Tier:** V2 Later  
**Audience:** Individual  
**Status:** Isolated workspace (not yet integrated with main app)

## Ownership Boundary

All code, components, services, hooks, tests, fixtures, documentation, and styles for this tool **must remain exclusively within**:

```
tools/v2/individual/pdf-summary-tool/
```

This is a hard boundary. No other part of the codebase should import from or depend on this folder, and this tool should not import from or depend on core application infrastructure.

---

## Module Boundaries & Internal Architecture

### Directory Structure

```
pdf-summary-tool/
├── ARCHITECTURE.md              # This file
├── CONTRIBUTOR_GUIDE.md         # How to extend this tool
├── DATA_OWNERSHIP.md            # Data flow and ownership
├── INTEGRATION_CONSTRAINTS.md   # What cannot be changed
├── MODULE_BOUNDARIES.md         # Internal module contract
├── README.md                    # Getting started
├── specs.md                     # Product specifications
│
├── components/                  # React components
│   ├── PDFUploadZone.tsx
│   ├── SummaryDisplay.tsx
│   ├── SummarySettings.tsx
│   └── README.md               # Component architecture notes
│
├── services/                    # Business logic & integrations
│   ├── pdfProcessing.ts         # PDF parsing and extraction
│   ├── summarization.ts         # Summarization logic
│   ├── storage.ts               # Local data persistence
│   └── README.md               # Service architecture notes
│
├── hooks/                       # React custom hooks
│   ├── usePDFSummary.ts
│   ├── useSummarySettings.ts
│   └── README.md               # Hook patterns
│
├── types/                       # TypeScript type definitions
│   ├── index.ts
│   └── README.md
│
├── utils/                       # Pure utility functions
│   ├── pdfValidation.ts
│   ├── textNormalization.ts
│   └── README.md
│
├── fixtures/                    # Local test fixtures
│   ├── sample-pdfs/
│   ├── expected-summaries.json
│   └── README.md
│
├── tests/                       # Vitest unit and integration tests
│   ├── unit/
│   │   ├── pdfProcessing.spec.ts
│   │   ├── summarization.spec.ts
│   │   └── hooks.spec.ts
│   ├── integration/
│   │   └── pdf-summary-flow.spec.ts
│   └── README.md
│
├── docs/                        # Local documentation
│   ├── API.md                   # Internal API reference
│   ├── DEVELOPMENT.md           # Local dev setup
│   ├── FUTURE_INTEGRATION.md    # How to integrate later
│   └── README.md
│
├── e2e/                         # Isolated E2E tests (future)
│   └── README.md
│
└── config/                      # Tool-specific configuration
    ├── defaults.ts
    └── README.md
```

### Module Definitions

#### **1. Components Module** (`components/`)

**Responsibility:** Present the PDF summary UI to users.

**Public API:**

- `<PDFUploadZone />` - File upload interface
- `<SummaryDisplay />` - Display summary results
- `<SummarySettings />` - Configuration UI

**Internal Dependencies:** Hooks, types, utils  
**External Dependencies:** Radix UI, React (design system only for styling)  
**Restrictions:** No direct server calls; must use hooks for data fetching

#### **2. Services Module** (`services/`)

**Responsibility:** Core business logic and data processing.

**Public API:**

- `pdfProcessing.extractText(file: File): Promise<string>` - Extract text from PDF
- `pdfProcessing.validatePDF(file: File): boolean` - Validate PDF file
- `summarization.generateSummary(text: string, settings: SummarySettings): Promise<string>` - Generate summary
- `storage.saveSummary(pdfId: string, summary: Summary): Promise<void>` - Store summary locally
- `storage.getSummary(pdfId: string): Promise<Summary | null>` - Retrieve stored summary

**Internal Dependencies:** Types, utils  
**External Dependencies:** PDF.js (for PDF parsing), local storage API only  
**Restrictions:** No network calls except to external API (if AI service needed); all state must be serializable; no localStorage access outside this module

#### **3. Hooks Module** (`hooks/`)

**Responsibility:** Encapsulate component-level state and side effects.

**Public API:**

- `usePDFSummary(file: File | null)` - Manage PDF upload and summary lifecycle
- `useSummarySettings()` - Manage summary preferences
- `useLocalSummaryStorage()` - Manage local persistence

**Internal Dependencies:** Services, types  
**Restrictions:** Only for React components; no pure utility functions; must export only hooks

#### **4. Types Module** (`types/`)

**Responsibility:** Centralized TypeScript definitions.

**Exports:**

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

// Additional types in types/index.ts
```

**Restrictions:** Only type definitions and interfaces; no implementation; no runtime code

#### **5. Utils Module** (`utils/`)

**Responsibility:** Pure, reusable utility functions.

**Public API:**

- `validatePDFFile(file: File): ValidationResult`
- `normalizeSummaryText(text: string): string`
- `extractKeywords(text: string, limit?: number): string[]`

**Restrictions:** Pure functions only; no side effects; no state; no external API calls

---

## Data Ownership & Flow

### Data Lifecycle

```
User Action
    ↓
[Component: PDFUploadZone]
    ↓
[Hook: usePDFSummary]
    ↓
[Service: pdfProcessing.extractText]
    ↓
[Service: summarization.generateSummary]
    ↓
[Service: storage.saveSummary]
    ↓
[Component: SummaryDisplay] (render from Hook)
```

### Data Storage Ownership

- **User PDFs:** Owned by the browser (never sent to server by default)
- **Extracted Text:** Temporary, in-memory only
- **Summaries:** Persisted in browser localStorage under tool-specific key: `pdf-summary-tool:summaries`
- **Settings:** Persisted in browser localStorage under: `pdf-summary-tool:settings`

**Constraint:** All data remains client-side unless explicitly integrated with server later.

### Data Isolation

- No data from this tool touches the main app's mail system
- No data from this tool touches the main app's wallet or Stellar core
- No data from this tool touches the main app's authentication system
- All data access is mediated through the Services module

---

## Integration Constraints

### Forbidden Integrations (Hard Boundaries)

**🚫 DO NOT:**

- Import from or depend on `src/` (main app)
- Import from `src/components/`, `src/services/`, `src/hooks/`
- Use main app's routing system
- Use main app's database schema
- Use main app's authentication
- Use main app's wallet/Stellar core
- Modify `src/routes/`, `src/server/`, or `src/router.tsx`
- Add navigation items to main app
- Hook into mail rendering engine
- Modify dashboard layout
- Use mail-specific types or schemas

### Allowed External Dependencies

✅ **Can use:**

- React core libraries (already in main app)
- Radix UI components (already in main app, for styling only)
- TypeScript utilities
- Local browser APIs (localStorage, File API, Blob API)
- PDF.js library (may need to add to monorepo)
- vitest for testing (already in main app)

### Future Integration Points

When this tool is ready to integrate with the main app (in a separate issue), the integration layer should:

1. Create a new file: `src/features/pdf-summary-tool/` in main app
2. Expose a React component that wraps this tool
3. Document the integration contract
4. Add navigation item separately in main app

**See:** [FUTURE_INTEGRATION.md](./docs/FUTURE_INTEGRATION.md)

---

## Component Boundaries

### What Each Module CAN Change

- **Components:** Internal JSX, styling, layout
- **Services:** Implementation details, algorithms
- **Hooks:** State management, lifecycle
- **Utils:** Function logic
- **Types:** Type definitions
- **Tests:** Test cases
- **Docs:** Documentation
- **Fixtures:** Test data

### What NO Module Can Change

- Main app routing (`src/routes/`, `src/router.tsx`)
- Main app server (`src/server/`)
- Main app database schema
- Main app authentication
- Mail rendering engine
- Inbox architecture
- Wallet core
- Stellar integration
- Design system tokens
- Navigation system
- Dashboard layout

---

## Testing Strategy

### Unit Tests (`tests/unit/`)

- Service functions: `pdfProcessing.spec.ts`, `summarization.spec.ts`
- Utility functions: `utils.spec.ts`
- Hooks behavior: `hooks.spec.ts`
- Local storage: `storage.spec.ts`

### Integration Tests (`tests/integration/`)

- PDF upload → summary generation flow
- Local storage persistence
- Settings propagation through hooks

### E2E Tests (`tests/e2e/`)

- Full user workflows (future)
- Browser-based PDF interaction

### Test Data

- Store fixtures in `fixtures/` folder
- Sample PDFs, expected outputs, mock data
- No reliance on main app's test fixtures

---

## Dependency Graph

```
Components
  └── Hooks
       └── Services
            ├── Types
            ├── Utils
            └── [External: PDF.js, localStorage]

Types (no dependencies)

Utils (no dependencies)

Tests (depend on all modules)
```

**Constraint:** No circular dependencies allowed.

---

## File Import Rules

### Valid Imports

```typescript
// ✅ VALID - within tool boundary
import { usePDFSummary } from "../hooks/usePDFSummary";
import { extractText } from "../services/pdfProcessing";
import type { Summary } from "../types";
import { normalizeSummaryText } from "../utils/textNormalization";

// ✅ VALID - external allowed
import React from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Input } from "@radix-ui/react-input";
```

### Invalid Imports

```typescript
// ❌ INVALID - tool should not import from main app
import { sendEmail } from "../../../src/services/email";
import { useMailContext } from "../../../src/features/mail/hooks";
import { useWallet } from "../../../src/features/ledger/hooks";

// ❌ INVALID - no server access
import { pdfSummaryAPI } from "../../../src/server/api";

// ❌ INVALID - no main app routing
import { useRouter } from "../../../src/router";
```

---

## Adding New Features

When adding features to this tool:

1. **Stay within boundaries:** All new code must be in `pdf-summary-tool/`
2. **Define types first:** Add types to `types/index.ts`
3. **Implement in services:** Add business logic to `services/`
4. **Create hooks if UI needs it:** Add to `hooks/`
5. **Build components:** Add to `components/`
6. **Write tests:** Add to `tests/`
7. **Document:** Update relevant README and docs
8. **Update ARCHITECTURE.md:** If boundaries change

---

## Contributors: What You Can and Cannot Modify

### ✅ Can Modify

- Anything in `tools/v2/individual/pdf-summary-tool/`
- All subdirectories and files within this folder
- Internal architecture of components, services, hooks
- Tests and fixtures
- Documentation within this folder

### ❌ Cannot Modify

- Main app shell (`src/`)
- Routing system (`src/routes/`, `src/router.tsx`)
- Inbox architecture
- Mail rendering engine
- Wallet/Stellar core
- Database schema
- Design system
- Main app navigation
- Main app dashboard

---

## Success Criteria

✅ Architecture contract is complete when:

1. Module boundaries are clearly defined
2. Data ownership is documented
3. Integration constraints are explicit
4. Folder structure matches specification
5. Internal architecture can be understood by future contributors
6. No code exists outside `tools/v2/individual/pdf-summary-tool/`
7. No imports from main app exist
8. Zero modifications to core app files
9. All architecture is documented locally
10. Tool is reviewable as self-contained mini-product

---

## References

- [MODULE_BOUNDARIES.md](./MODULE_BOUNDARIES.md) - Detailed module specifications
- [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md) - Complete data flow documentation
- [INTEGRATION_CONSTRAINTS.md](./INTEGRATION_CONSTRAINTS.md) - Hard boundaries
- [CONTRIBUTOR_GUIDE.md](./CONTRIBUTOR_GUIDE.md) - How to contribute
- [docs/FUTURE_INTEGRATION.md](./docs/FUTURE_INTEGRATION.md) - Integration roadmap
