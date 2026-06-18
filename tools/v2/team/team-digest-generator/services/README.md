# Services

Business logic and data processing for the Team Digest Generator.

## Module Responsibility

- Email aggregation and filtering
- Digest content generation
- Team member resolution
- Schedule management
- Input validation and sanitization
- Content security and normalization

## Services to Implement

### `digestAggregation.ts`

- Collect emails for digest period
- Sort and organize by sender/thread
- Apply user-configured filters
- Generate summary data

### `emailFiltering.ts`

- Apply digest-specific filters
- Handle excluded senders/categories
- Date range filtering
- Priority-based selection

### `teamResolution.ts`

- Resolve team member identities
- Map email addresses to team members
- Handle permission checking (future integration)
- Validate team membership

### `contentSanitization.ts`

- Remove sensitive data (passwords, tokens)
- Sanitize HTML content
- Strip unnecessary formatting
- Normalize encoding

### `scheduleManagement.ts`

- Parse cron or schedule expressions
- Calculate next digest time
- Handle timezone awareness
- Validate schedule validity

## Performance Constraints

- Handle 1000+ emails per digest efficiently
- Sanitization should be streaming when possible
- No unnecessary data duplication
- Memory usage should scale linearly

## Security Constraints

- Validate all input before processing
- Sanitize all email content
- No logging of sensitive data
- Fail safely on malformed input

## Guidelines

- Pure functions where possible
- Comprehensive error handling
- Type-safe implementations
- Testable, isolated logic
