# Tests

Unit and integration tests for the Team Digest Generator.

## Coverage Goals

- Unit tests for all services (validation, aggregation, sanitization)
- Component rendering tests
- Integration tests for workflows
- Input validation and sanitization tests
- Performance benchmarks for large datasets

## Test Structure

```
tests/
├── services/
│   ├── digestAggregation.test.ts
│   ├── emailFiltering.test.ts
│   ├── teamResolution.test.ts
│   ├── contentSanitization.test.ts
│   └── scheduleManagement.test.ts
├── components/
│   ├── DigestConfigForm.test.tsx
│   ├── DigestPreview.test.tsx
│   └── TeamMemberSelector.test.tsx
├── hooks/
│   ├── useDigestConfig.test.ts
│   └── useDigestPreview.test.ts
├── fixtures/
│   ├── mockEmails.ts
│   ├── mockTeamMembers.ts
│   └── mockSchedules.ts
└── performance/
    └── largeDataset.test.ts
```

## Local Fixtures

- **mockEmails.ts** - Sample email data for testing
- **mockTeamMembers.ts** - Sample team member data
- **mockSchedules.ts** - Sample schedule configurations
- **testData.ts** - Common test utilities

## Security Testing

- Malformed input handling
- XSS prevention in sanitization
- Path traversal prevention
- SQL injection prevention (if applicable)
- Large input handling (DoS prevention)

## Performance Testing

- Digests with 1000+ emails
- Large attachment handling
- Memory usage with large datasets
- Concurrent operations

## Guidelines

- Use local fixtures only, no database access
- Mock external dependencies
- Write tests for all new functionality
- Maintain >80% code coverage
- Document test scenarios and edge cases
