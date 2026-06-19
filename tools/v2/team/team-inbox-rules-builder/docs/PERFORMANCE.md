# Performance Hardening - Team Inbox Rules Builder

This document outlines the performance considerations and optimizations for the Team Inbox Rules Builder, especially when dealing with large datasets.

## Scalability Constraints

### 1. Large Emails
- **Issue**: Evaluating rules against very large email bodies (e.g., several megabytes of text) can block the main thread.
- **Optimization**:
    - Limit the amount of text processed for `contains` and `matches` operations (e.g., first 100KB).
    - Use efficient string searching algorithms where possible.

### 2. Large Rule Sets
- **Issue**: A team might define hundreds of rules. Evaluating all of them for every email can lead to latency.
- **Optimization**:
    - Rules are sorted by priority and can be early-exited if a "Stop processing" action is implemented.
    - Memoize evaluation results where appropriate.

### 3. Attachments and Headers
- **Issue**: Emails with hundreds of attachments or headers can slow down field extraction and matching.
- **Optimization**:
    - Limits on the number of attachments/headers processed during evaluation.

## Performance Benchmarks (Target)

| Metric | Target |
|--------|--------|
| Rule Evaluation (100 rules, 1MB mail) | < 50ms |
| Rule Search (500 rules) | < 10ms |
| Rule List Render (100 rules) | < 16ms (60fps) |

## Optimization Strategies

- **Synchronous Evaluation**: Keep evaluation logic pure and synchronous to avoid event loop overhead, while being mindful of execution time.
- **In-Memory Map**: Use `Map` for rule storage for O(1) lookups by ID.
- **Lazy Loading**: If integrated with the UI, large rule lists should use virtualization.
- **Debounced Search**: All search and filter operations in the UI are debounced.
