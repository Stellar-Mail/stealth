# Types

TypeScript type definitions for the PDF Summary Tool.

## Guidelines

- ✅ Type definitions only (no runtime code)
- ✅ Interfaces and types
- ✅ Docstring comments
- ✅ Export from index.ts for central access

- ❌ No implementations
- ❌ No function bodies
- ❌ No imports from components or services
- ❌ No imports from main app

## Core Types

- `PDF` - Represents a PDF file with metadata
- `Summary` - Represents a generated summary
- `SummarySettings` - Configuration for summary generation
- `ValidationResult` - Result of validation operations

## File Organization

All types should be defined in `index.ts`. If the file becomes too large, split into domain-specific files but still export from `index.ts`.

Example:

```typescript
// types/index.ts
export type { PDF, Summary } from "./pdf";
export type { SummarySettings } from "./settings";
export type { ValidationResult } from "./validation";
```

See [../CONTRIBUTOR_GUIDE.md](../CONTRIBUTOR_GUIDE.md#adding-a-component) for documentation patterns.
