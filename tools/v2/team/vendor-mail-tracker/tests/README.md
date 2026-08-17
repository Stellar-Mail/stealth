# Vendor Mail Tracker Tests

This directory contains all tests for the Vendor Mail Tracker tool.

## Structure

- `unit/` - Unit tests for services, hooks, and components
- `integration/` - Integration tests for workflows and cross-module functionality
- `fixtures.ts` - Shared test data and mock builders

## Running Tests

```bash
# Run all tests
npm run test:vendor-tracker

# Run specific test suite
npm run test:vendor-tracker -- services

# Watch mode
npm run test:vendor-tracker -- --watch
```

## Test Fixtures

Use the fixtures from `fixtures.ts` to create consistent test data:

```typescript
import { createMockVendor, createMockTracking } from "./fixtures";

const vendor = createMockVendor({ name: "Test Vendor" });
const tracking = createMockTracking({ vendorId: vendor.id });
```

## Best Practices

1. **Use local fixtures** - Don't fetch from main app or external sources
2. **Test in isolation** - Mock dependencies via dependency injection
3. **Test behavior, not implementation** - Focus on what the code does, not how
4. **Keep tests maintainable** - Use descriptive names and organize logically

## Future Integration Tests

When connecting to main app, add integration tests here that verify:

- Service contracts with main app
- Hook composition with main app hooks
- Component compatibility with main design system
