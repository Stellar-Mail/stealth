# Email Translator Tests

This directory contains tests for the Email Translator tool.

## Test Coverage

### `validation.test.ts`

Tests for security validation and sanitization utilities:

- Email body sanitization (XSS prevention, size limits)
- Language code validation (injection prevention)
- Provider configuration validation (endpoint allowlisting)
- Provider response sanitization
- Security guards (ReDoS, prototype pollution, clipboard injection)
- JSON parsing safety

### `performance.test.ts`

Tests for performance optimization utilities:

- Timeout enforcement
- Text chunking for large inputs
- Translation result caching and deduplication
- Debouncing and throttling
- Rate-limited queues
- Performance monitoring and metrics
- Memory limit checks

## Running Tests

### Run all tests

```bash
npm test
```

### Run tests in watch mode

```bash
npm run test:watch
```

### Run specific test file

```bash
npm test validation.test.ts
npm test performance.test.ts
```

### Run with coverage

```bash
npm test -- --coverage
```

## Test Dependencies

The tests use:

- **vitest** - Test runner (already in project)
- **@testing-library/react** - React component testing (for future component tests)
- **dompurify** - HTML sanitization library (required for validation module)

## Required Setup

Before running tests, ensure dependencies are installed:

```bash
npm install
# or
bun install
```

The validation module requires `dompurify`. If not already installed:

```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

## Test Structure

Tests follow the Arrange-Act-Assert pattern:

```typescript
it("should sanitize email body", () => {
  // Arrange
  const input = '<script>alert("xss")</script>Hello';

  // Act
  const result = sanitizeEmailBody(input);

  // Assert
  expect(result).toBe("Hello");
  expect(result).not.toContain("<script>");
});
```

## Security Test Cases

Security tests verify protection against:

1. **XSS (Cross-Site Scripting)**
   - HTML tag injection
   - Encoded script attacks
   - Provider response XSS

2. **Injection Attacks**
   - SQL injection in language codes
   - Command injection
   - Path traversal

3. **DoS (Denial of Service)**
   - ReDoS (Regular Expression DoS)
   - Memory exhaustion via oversized inputs
   - Parser exhaustion via deeply nested structures

4. **Data Exfiltration**
   - Endpoint validation (allowlist enforcement)
   - API key exposure prevention

5. **Prototype Pollution**
   - `__proto__` injection
   - Constructor poisoning

## Performance Test Cases

Performance tests verify:

1. **Timeout Handling**
   - Promise timeout enforcement
   - Fetch request cancellation

2. **Large Input Handling**
   - Text chunking at sentence boundaries
   - Memory-efficient chunk processing

3. **Caching and Deduplication**
   - Translation result caching with TTL
   - In-flight request deduplication
   - LRU cache eviction

4. **Rate Limiting**
   - Request queue management
   - Inter-request delays

5. **Performance Monitoring**
   - Duration measurement
   - Memory delta tracking
   - Success rate calculation

## Future Test Coverage

When implementation is added:

### `hooks/` tests

- `useTranslation` hook behavior
- `useLanguageDetect` hook behavior
- State management and side effects

### `components/` tests

- Component rendering
- User interactions
- Accessibility (a11y)
- Error states

### `services/` tests

- Translation provider implementations
- Language detection algorithms
- Service orchestration

### Integration tests

- End-to-end translation flow
- Provider switching
- Error recovery

## Continuous Integration

Tests should run in CI on:

- Pull request creation
- Push to main branch
- Scheduled daily runs

CI should enforce:

- All tests pass
- Code coverage > 80%
- No security vulnerabilities in dependencies
- No linting errors

## Test Fixtures

Fixtures for testing should be added to a `fixtures/` directory:

```
tests/
├── fixtures/
│   ├── email-samples/
│   │   ├── simple.txt
│   │   ├── with-html.html
│   │   ├── large.txt (100KB+)
│   │   └── malicious.txt (XSS attempts)
│   └── translations/
│       ├── en-es-samples.json
│       └── mock-responses.json
├── validation.test.ts
├── performance.test.ts
└── README.md
```

## Debugging Tests

### Enable verbose logging

```bash
npm test -- --reporter=verbose
```

### Run single test

```bash
npm test -- -t "should sanitize email body"
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["test", "--", "--run"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Contributing

When adding new features:

1. Write tests first (TDD)
2. Ensure all tests pass
3. Update this README if adding new test categories
4. Document any new fixtures or test utilities

## Security Testing Guidelines

For security-sensitive code:

1. **Test the attack, not just the feature**
   - Example: Don't just test valid language codes, test injection attempts

2. **Use real-world attack vectors**
   - Reference OWASP Top 10
   - Include examples from CVE databases

3. **Test edge cases**
   - Empty strings, null, undefined
   - Extremely large inputs
   - Malformed data

4. **Document why each test exists**
   - Link to security documentation
   - Explain the threat being mitigated

## Performance Testing Guidelines

For performance-critical code:

1. **Set measurable targets**
   - Example: "Translation should complete in <2s"

2. **Test with realistic data sizes**
   - Small (1KB), medium (100KB), large (1MB) inputs

3. **Verify resource cleanup**
   - No memory leaks
   - Timers are cleared
   - Abort controllers are cleaned up

4. **Test under load**
   - Concurrent requests
   - Rapid sequential calls
   - Resource exhaustion scenarios
