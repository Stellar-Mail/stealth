# Hooks

React custom hooks for the PDF Summary Tool.

## Guidelines

- ✅ Use only React hooks (useState, useEffect, useCallback, useMemo, etc.)
- ✅ Call services to fetch/process data
- ✅ Manage component-level state
- ✅ Return clear, documented API
- ✅ Handle async operations
- ✅ Use types from `../types`

- ❌ Don't call other hooks directly
- ❌ Don't call services from components (route through hooks)
- ❌ Don't import components
- ❌ Don't import from main app
- ❌ Don't access localStorage directly (delegate to services)

## Patterns

All hooks should follow this pattern:

```typescript
export function useMyHook(input: InputType) {
  const [data, setData] = useState<DataType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    // Setup logic
  }, [input]);

  return { data, isLoading, error };
}
```

## Examples

- `usePDFSummary.ts` - Manage PDF upload and summarization
- `useSummarySettings.ts` - Manage user preferences
- `useLocalSummaryStorage.ts` - Manage local persistence

## Testing

Test hooks in `../tests/unit/hooks/` using Vitest and React Hooks Testing Library.

See [../CONTRIBUTOR_GUIDE.md](../CONTRIBUTOR_GUIDE.md#adding-a-hook) for examples.
