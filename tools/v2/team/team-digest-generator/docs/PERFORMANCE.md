# Team Digest Generator - Performance Constraints

## Overview

This document defines performance goals, optimization strategies, and scaling considerations for the Team Digest Generator.

---

## Performance Goals

| Metric                          | Target      | Max Acceptable |
| ------------------------------- | ----------- | -------------- |
| Preview generation              | < 2 seconds | 5 seconds      |
| Digest generation (1000 emails) | < 5 seconds | 10 seconds     |
| Sanitization (10MB HTML)        | < 1 second  | 3 seconds      |
| Filter evaluation (10k emails)  | < 2 seconds | 5 seconds      |
| Memory per digest (1000 emails) | < 50MB      | 200MB          |
| Recipients per digest           | 500         | 1000           |

---

## Scaling Constraints

### Email Volume

**Constraint:** Avoid unnecessary work on large datasets

**Strategy:**

```typescript
// BAD: Load all emails into memory first
const allEmails = await loadAllEmails(teamId, dateRange);
const filtered = allEmails.filter((e) => matchesFilter(e));
const sanitized = filtered.map((e) => sanitizeContent(e));

// GOOD: Stream and filter as we go
const digestEmails = [];
for await (const email of streamEmails(teamId, dateRange)) {
  if (matchesFilter(email)) {
    const sanitized = sanitizeContent(email);
    digestEmails.push(sanitized);
    if (digestEmails.length >= 10000) break; // Hard limit
  }
}
```

**Limits:**

- Max 10,000 emails per digest
- Max 1,000 recipients per digest
- Stream processing, not batch loading
- Break early if limits reached

### Attachment Handling

**Constraint:** Avoid processing large attachments

**Strategy:**

```typescript
// Only process attachment metadata, never download/parse content
interface AttachmentInfo {
  filename: string;
  mimeType: string;
  sizeBytes: number; // Metadata only
  // Do NOT include: content, buffer, parsed data
}

function processAttachment(metadata: AttachmentInfo): DigestAttachment | null {
  // Validate size
  if (metadata.sizeBytes > 100 * 1024 * 1024) {
    return null; // Skip large attachments
  }

  // Return metadata only
  return {
    filename: sanitizeFilename(metadata.filename),
    size: formatBytes(metadata.sizeBytes),
  };
}
```

**Limits:**

- Max 100MB per attachment (reject larger)
- Never download attachment content for digest
- Only show metadata (filename, size, type)
- Skip attachments if total size > 500MB for digest

### Team Size

**Constraint:** Handle variable team sizes efficiently

**Strategy:**

```typescript
// Validate recipient count up front
const recipients = parseRecipients(input);
if (recipients.length > 1000) {
  throw new Error("Too many recipients: max 1000");
}

// Use Set for deduplication, not array filtering
const uniqueRecipients = new Set(recipients.map((r) => r.email));
```

**Limits:**

- Max 1,000 recipients per digest
- De-duplicate recipients upfront
- Use efficient data structures (Set, Map)

### Date Range History

**Constraint:** Avoid processing months/years of history

**Strategy:**

```typescript
// Limit to recent period
const maxDays = 90;
const now = new Date();
const minDate = new Date(now.getTime() - maxDays * 24 * 60 * 60 * 1000);

if (dateRange.start < minDate) {
  throw new Error("Date range too old: max 90 days");
}

// Use indexed queries on date range
const emails = await queryEmailsOptimized(teamId, {
  dateFrom: dateRange.start,
  dateTo: dateRange.end,
  limit: 10000,
});
```

**Limits:**

- Max 90 days per digest
- Default to last 7 days
- Use indexed queries on timestamps

---

## Optimization Strategies

### 1. Lazy Loading and Streaming

**Bad:**

```typescript
const emails = await db.emails.find(query).toArray(); // All at once
```

**Good:**

```typescript
const cursor = db.emails.find(query).limit(10000); // Streaming cursor
for await (const email of cursor) {
  // Process one at a time
}
```

### 2. Early Exit on Limits

**Bad:**

```typescript
const allEmails = await loadAllEmails();
const filtered = allEmails.filter(f).map(m).sort(s);
```

**Good:**

```typescript
const result = [];
for await (const email of streamEmails()) {
  if (matchesFilter(email)) {
    result.push(email);
    if (result.length >= 10000) break; // Exit early
  }
}
```

### 3. Efficient Data Structures

**Avoid:**

- `Array.includes()` - O(n) lookup
- Array filtering multiple times
- String concatenation in loops

**Use:**

- `Set` for membership testing - O(1) lookup
- Single pass transforms
- String builders (array join, not concatenation)

```typescript
// Bad
const excluded = [];
for (const sender of excludedSenders) {
  excluded.push(sender);
}
if (excluded.includes(email.from)) {
} // O(n)

// Good
const excluded = new Set(excludedSenders); // O(n) once
if (excluded.has(email.from)) {
} // O(1) per check
```

### 4. Sanitization Optimization

**Strategy:**

- Cache sanitization results (same subject = same output)
- Stream sanitization, don't buffer
- Use single-pass regex where possible

```typescript
// Sanitization with caching
const sanitizationCache = new Map<string, string>();

function sanitizeWithCache(html: string): string {
  if (sanitizationCache.has(html)) {
    return sanitizationCache.get(html)!;
  }
  const result = sanitizeEmailContent(html);
  sanitizationCache.set(html, result);
  return result;
}

// Clear cache periodically to prevent unbounded growth
setInterval(() => sanitizationCache.clear(), 60 * 60 * 1000); // 1 hour
```

### 5. Index Strategy

For large-scale production, ensure these indexes exist:

```sql
-- Email queries by date range
CREATE INDEX idx_emails_team_date ON emails(team_id, created_at DESC);

-- Filtering by sender
CREATE INDEX idx_emails_from ON emails(from);

-- Filtering by category
CREATE INDEX idx_emails_category ON emails(category);
```

---

## Memory Management

### Budget Allocation

For a digest with 1000 emails:

- Email metadata (100 bytes each): ~100KB
- Sanitized content (5KB average): ~5MB
- Aggregation structures (Sets, Maps): ~1MB
- **Total budget:** 50MB (with 10x safety margin)

### Preventing Memory Leaks

```typescript
// Use WeakMap for caches to allow garbage collection
const emailCache = new WeakMap<Email, ProcessedEmail>();

// Clear large structures after use
function generateDigest(config: DigestConfig): void {
  const emailBuffer = [];
  try {
    // Process emails
    for (const email of streamEmails(config)) {
      emailBuffer.push(processEmail(email));
    }
  } finally {
    // Always clean up
    emailBuffer = [];
    sanitizationCache.clear();
  }
}

// Monitor memory during processing
function monitorMemory(): void {
  const used = process.memoryUsage();
  if (used.heapUsed > 500 * 1024 * 1024) {
    // 500MB threshold
    throw new Error("Memory limit exceeded");
  }
}
```

---

## Performance Testing

### Benchmarks to Add

```typescript
describe("Performance - Email Processing", () => {
  it("should process 1000 emails in < 5 seconds", async () => {
    const emails = generateMockEmails(1000);
    const start = Date.now();

    const result = await aggregateEmails(emails);

    expect(Date.now() - start).toBeLessThan(5000);
  });

  it("should sanitize 10MB HTML in < 1 second", async () => {
    const html = generateLargeHtml(10 * 1024 * 1024);
    const start = Date.now();

    const sanitized = sanitizeEmailContent(html);

    expect(Date.now() - start).toBeLessThan(1000);
  });

  it("should use < 50MB memory for 1000 emails", async () => {
    const emails = generateMockEmails(1000);
    const startMem = process.memoryUsage().heapUsed;

    const result = await aggregateEmails(emails);

    const endMem = process.memoryUsage().heapUsed;
    expect(endMem - startMem).toBeLessThan(50 * 1024 * 1024);
  });
});
```

### Load Testing Scenarios

1. **Concurrent digests:** 10 digests generating simultaneously
2. **Large dataset:** 10,000 emails in single digest
3. **Complex filters:** 1000 exclusion rules evaluated
4. **Large content:** 10MB average email content
5. **Peak load:** 100 teams requesting digest in 1-minute window

---

## Optimization Roadmap

### Phase 1 (MVP)

- ✅ Streaming queries
- ✅ Early exit on limits
- ✅ Efficient data structures
- ✅ Memory monitoring

### Phase 2 (Future)

- Database query optimization and indexing
- Caching layer for repeated digests
- Parallel processing for independent operations
- Compression for large digest storage

### Phase 3 (Future Integration)

- Scheduled digest generation (off-peak)
- Incremental digest updates
- Digest versioning and history

---

## Configuration

### Performance Tuning Parameters

```typescript
export const PERFORMANCE_LIMITS = {
  maxEmailsPerDigest: 10_000,
  maxRecipientsPerDigest: 1_000,
  maxExclusionRules: 1_000,
  maxDateRangeInDays: 90,
  maxAttachmentSizeBytes: 100 * 1024 * 1024,
  maxTotalAttachmentSizeBytes: 500 * 1024 * 1024,
  maxMemoryBudgetBytes: 500 * 1024 * 1024,
  previewGenerationTimeoutMs: 5_000,
  digestGenerationTimeoutMs: 10_000,
  sanitizationTimeoutMs: 3_000,
};
```

---

## Monitoring & Alerting

### Metrics to Track

- P95 digest generation time
- Peak memory usage per digest
- Cache hit rate for sanitization
- Query execution time
- Failed digest generations
- Timeouts or resource limit hits

### Alert Thresholds

- If P95 > 8 seconds: Investigate query optimization
- If memory > 300MB: Investigate memory leaks
- If timeouts > 1%: Reduce feature scope or increase limits
- If failures > 0.1%: Investigate root cause

---

## Performance Review Checklist

Before considering digest feature performant:

- [ ] All performance benchmarks pass
- [ ] Memory profiling shows < 50MB for 1000 emails
- [ ] Load tests pass with concurrent digests
- [ ] Streaming is used, not batch loading
- [ ] Early exit implemented for all limits
- [ ] Caching implemented for sanitization
- [ ] Indexes present (if using database)
- [ ] Monitoring alerts configured
- [ ] Documentation updated
