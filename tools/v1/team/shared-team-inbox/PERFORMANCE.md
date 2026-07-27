# Performance Constraints & Guidelines: Shared Team Inbox (V1)

## 1. Resource Limits & Hard Bounds

- **Maximum Page Size**: 50 items per virtualized or paginated fetch.
- **Maximum Preview Body Length**: 100,000 characters (~100KB text). Text exceeding this limit is truncated with a `[Truncated for performance]` placeholder.
- **Attachment List Limit**: Maximum 20 attachments displayed in primary UI preview.
- **Team Size Scale**: Local cache structures memoized per `teamId`.

## 2. Optimization Strategies

1. **Virtual Windowing**: Avoid rendering hidden DOM nodes for deep message threads or large team inbox lists.
2. **Lazy Evaluation**: Body sanitization and heavy HTML parsing occur on-demand when a thread is expanded, not during initial list loading.
3. **Memoization**: Filtered and sanitized inbox feeds must be wrapped in `useMemo` with strict identity tracking (`message.id` + `message.updatedAt`).
