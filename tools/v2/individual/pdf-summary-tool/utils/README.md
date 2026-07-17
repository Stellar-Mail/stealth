# Utils

Pure utility functions for the PDF Summary Tool.

## Guidelines

- ✅ Pure functions only (no side effects)
- ✅ No state
- ✅ Deterministic output
- ✅ Well-documented inputs/outputs
- ✅ Return consistent types
- ✅ Use types from `../types`

- ❌ No async code
- ❌ No external API calls
- ❌ No localStorage or DOM access
- ❌ No React
- ❌ No imports from main app

## Examples

- `pdfValidation.ts` - Validate PDF files (size, type)
- `textNormalization.ts` - Clean and normalize text
- `textAnalysis.ts` - Analyze text (keyword extraction, etc.)

## Testing

Test utilities in `../tests/unit/utils/` using Vitest.

See [../CONTRIBUTOR_GUIDE.md](../CONTRIBUTOR_GUIDE.md#adding-a-utility-function) for examples.
