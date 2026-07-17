# Components

React presentational components for the PDF Summary Tool.

## Guidelines

- ✅ Import hooks to get data
- ✅ Accept props for configuration
- ✅ Emit events via callbacks
- ✅ Import types from `../types`
- ✅ Use local CSS or Tailwind for styling
- ✅ Use Radix UI components for UI elements

- ❌ Don't call services directly (use hooks)
- ❌ Don't access localStorage directly
- ❌ Don't import from main app
- ❌ Don't use global state

## Examples

- `PDFUploadZone.tsx` - Upload input component
- `SummaryDisplay.tsx` - Summary output component
- `SummarySettings.tsx` - Settings configuration UI

## Testing

Test components in `../tests/unit/components/` using Vitest and React Testing Library.

See [../CONTRIBUTOR_GUIDE.md](../CONTRIBUTOR_GUIDE.md#adding-a-component) for examples.
