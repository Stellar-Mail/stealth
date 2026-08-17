# Services

Business logic and data processing services for the PDF Summary Tool.

## Guidelines

- ✅ Export stateless, pure functions
- ✅ Accept parameters, return results
- ✅ Use types from `../types`
- ✅ Call utilities from `../utils`
- ✅ Use localStorage with prefix `pdf-summary-tool:` for persistence
- ✅ Handle errors explicitly
- ✅ Document all public functions

- ❌ Don't use React or React hooks
- ❌ Don't call components
- ❌ Don't maintain state
- ❌ Don't import from main app
- ❌ Don't make server calls (unless explicitly added for integration)

## Modules

- `pdfProcessing.ts` - Extract text from PDFs, validate files
- `summarization.ts` - Generate summaries from text
- `storage.ts` - Persist and retrieve summaries from localStorage

## localStorage Keys

All keys must use prefix: `pdf-summary-tool:`

- `pdf-summary-tool:summaries` - Stored summaries array
- `pdf-summary-tool:settings` - User settings

## Testing

Test services in `../tests/unit/services/` using Vitest.

See [../CONTRIBUTOR_GUIDE.md](../CONTRIBUTOR_GUIDE.md#adding-a-service) for examples.
