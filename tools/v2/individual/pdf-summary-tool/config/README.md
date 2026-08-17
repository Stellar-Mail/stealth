# Configuration

Tool-specific configuration files.

## Files

- `defaults.ts` - Default configuration values for the tool
- `constants.ts` - Tool constants and limits

## Examples

### defaults.ts

```typescript
export const SUMMARY_SETTINGS_DEFAULTS = {
  length: "medium" as const,
  style: "paragraph" as const,
  includeKeywords: false,
  language: "en",
};

export const PDF_PROCESSING_DEFAULTS = {
  maxFileSizeBytes: 50 * 1024 * 1024, // 50MB
  supportedMimeTypes: ["application/pdf"],
};
```

### constants.ts

```typescript
export const STORAGE_KEYS = {
  SUMMARIES: "pdf-summary-tool:summaries",
  SETTINGS: "pdf-summary-tool:settings",
} as const;

export const LIMITS = {
  MAX_PDF_SIZE_MB: 50,
  MIN_TEXT_LENGTH: 10,
  MAX_SUMMARY_LENGTH: 5000,
} as const;
```

## Usage

```typescript
import { SUMMARY_SETTINGS_DEFAULTS } from "../config/defaults";

const settings = SUMMARY_SETTINGS_DEFAULTS;
```

## Guidelines

- ✅ Keep configuration in one place
- ✅ Export constants for limits
- ✅ Use const assertions for type safety
- ✅ Document what each config does

- ❌ Don't import from main app config
- ❌ Don't use environment variables (use package.json)
