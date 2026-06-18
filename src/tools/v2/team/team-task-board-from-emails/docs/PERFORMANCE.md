# Team Task Board from Emails - Performance Guide

## Document Purpose

This document outlines performance constraints, optimization strategies, and resource management for the Team Task Board from Emails tool when handling large emails, attachments, teams, and histories.

## Performance Constraints

### Time Limits

| Operation               | Limit      | Rationale                                              |
| ----------------------- | ---------- | ------------------------------------------------------ |
| Single email processing | 5 seconds  | Prevent UI blocking, maintain responsiveness           |
| Thread processing       | 30 seconds | Allow complex thread analysis while preventing timeout |
| Batch processing        | 5 minutes  | Balance throughput with resource availability          |
| Regex execution         | 100ms      | Prevent ReDoS attacks                                  |

### Memory Limits

| Resource             | Limit                          | Rationale                                             |
| -------------------- | ------------------------------ | ----------------------------------------------------- |
| Per email            | 50 MB                          | Prevent single email from exhausting memory           |
| Per thread           | N/A (derived from email count) | Bounded by email limits and count                     |
| Per batch            | 500 MB                         | Allow parallel processing while preventing exhaustion |
| Regex working memory | 10,000 steps                   | Prevent catastrophic backtracking                     |

### Size Limits

| Item                          | Limit          | Rationale                                 |
| ----------------------------- | -------------- | ----------------------------------------- |
| Email body                    | 5 MB           | Balance functionality with performance    |
| Email subject                 | 998 characters | RFC 5322 compliance                       |
| Attachment (single)           | 25 MB          | Prevent resource exhaustion               |
| Attachments (total per email) | 100 MB         | Reasonable limit for email use cases      |
| Thread depth                  | 50 levels      | Prevent stack overflow                    |
| Thread size                   | 500 emails     | Performance optimization for UI rendering |
| Batch size                    | 1,000 emails   | Balance throughput with memory            |
| Recipients per email          | 100            | Prevent spam processing overhead          |

### Complexity Limits

| Operation               | Limit        | Rationale                                |
| ----------------------- | ------------ | ---------------------------------------- |
| Concurrent operations   | 10           | Prevent thread pool exhaustion           |
| Archive file count      | 100 files    | Prevent zip bomb expansion               |
| Compression ratio       | 100:1        | Detect zip bombs                         |
| Cross-thread references | 10 per email | Prevent complex graph traversal overhead |

## Performance Optimization Strategies

### Strategy 1: Streaming Processing

**Problem:** Large email bodies (1-5 MB) consume significant memory if loaded entirely.

**Solution:** Stream processing for bodies over 1 MB threshold.

**Implementation:**

```typescript
// Instead of loading entire body into memory:
const body = await fetchEmailBody(emailId); // ❌ Loads all at once

// Use streaming:
const stream = await fetchEmailBodyStream(emailId); // ✅ Streams chunks
for await (const chunk of stream) {
  processChunk(chunk);
}
```

**Benefits:**

- Constant memory usage regardless of body size
- Faster time-to-first-byte
- Can process bodies larger than memory limit

**Trade-offs:**

- More complex code
- Cannot backtrack in stream
- Requires stateful parsing

### Strategy 2: Lazy Loading

**Problem:** Processing entire threads upfront is wasteful if only recent emails are needed.

**Solution:** Load thread emails on-demand.

**Implementation:**

```typescript
// Instead of:
const thread = await loadEntireThread(threadId); // ❌ Loads all emails

// Use lazy loading:
const threadHandle = createThreadHandle(threadId);
const recentEmails = await threadHandle.loadRecent(10); // ✅ Load only recent
```

**Benefits:**

- Faster initial load
- Reduced memory footprint
- Better user experience (show recent content immediately)

**Trade-offs:**

- Additional requests for full thread view
- Complexity in cache management

### Strategy 3: Incremental Validation

**Problem:** Validating entire email object upfront blocks processing.

**Solution:** Validate fields incrementally as they're needed.

**Implementation:**

```typescript
// Instead of:
const result = validateEmail(email); // ❌ Validates all fields
if (!result.isValid) return error;

// Use incremental validation:
validateRequiredFields(email); // ✅ Fast check first
// ... start processing ...
validateContentIfNeeded(email.body); // Later, if needed
```

**Benefits:**

- Fail fast on critical errors
- Defer expensive validation
- Better responsiveness

**Trade-offs:**

- More complex error handling
- Partial validation state

### Strategy 4: Batch Processing with Chunking

**Problem:** Processing 1,000 emails sequentially is slow and blocks other operations.

**Solution:** Process in chunks of 100 with yield points.

**Implementation:**

```typescript
// Instead of:
for (const email of emails) {
  // ❌ Blocks for entire batch
  await processEmail(email);
}

// Use chunking:
const CHUNK_SIZE = 100;
for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
  const chunk = emails.slice(i, i + CHUNK_SIZE);
  await processChunk(chunk);
  await yield(); // ✅ Yield to event loop
}
```

**Benefits:**

- Prevents UI blocking
- Allows cancellation between chunks
- Better perceived performance

**Trade-offs:**

- Longer total time
- More complex state management

### Strategy 5: Content-Based Caching

**Problem:** Re-parsing the same email content multiple times wastes CPU.

**Solution:** Cache parsed results with LRU eviction.

**Implementation:**

```typescript
// Cache with LRU eviction (max 1000 entries)
const cache = new LRUCache<string, ParseResult>({ max: 1000 });

function parseEmailCached(email: EmailInput): ParseResult {
  const cacheKey = email.id;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!; // ✅ Return cached result
  }

  const result = parseEmail(email);
  cache.set(cacheKey, result);
  return result;
}
```

**Benefits:**

- Avoid redundant parsing
- Faster subsequent access
- Predictable memory usage (bounded cache)

**Trade-offs:**

- Memory overhead for cache
- Cache invalidation complexity

### Strategy 6: Early Termination

**Problem:** Processing continues even after determining result.

**Solution:** Short-circuit logic when outcome is determined.

**Implementation:**

```typescript
// Instead of checking everything:
const errors = [];
validateField1(email, errors); // ❌ Continues even if critical error
validateField2(email, errors);
validateField3(email, errors);

// Use early termination:
if (!hasRequiredFields(email)) {
  return earlyError("missing_required_fields"); // ✅ Stop immediately
}
// ... continue only if basic validation passes
```

**Benefits:**

- Faster failure detection
- Reduced CPU usage
- Better error messages

**Trade-offs:**

- May miss secondary errors
- Requires careful ordering of checks

### Strategy 7: Parallel Processing

**Problem:** Sequential email processing is slow for large batches.

**Solution:** Process multiple emails concurrently (up to limit).

**Implementation:**

```typescript
// Instead of sequential:
for (const email of emails) {
  await processEmail(email); // ❌ One at a time
}

// Use parallel processing:
const promises = emails.map((email) => processEmail(email));
await Promise.all(promises); // ✅ Process concurrently

// Or with concurrency limit:
await pMap(emails, processEmail, { concurrency: 10 }); // ✅ Max 10 concurrent
```

**Benefits:**

- Faster total throughput
- Better CPU utilization
- Scalable performance

**Trade-offs:**

- Higher peak memory usage
- More complex error handling
- Need concurrency limits

## Large Dataset Handling

### Large Emails (>1 MB Body)

**Characteristics:**

- Rich HTML formatting with embedded images
- Long conversation threads quoted in body
- Automated reports with extensive data

**Performance Impact:**

- Memory: High (full body in memory)
- CPU: Medium (parsing HTML, sanitization)
- Time: Medium (proportional to size)

**Optimizations:**

1. **Stream processing**: Don't load entire body at once
2. **Chunk parsing**: Parse in 100KB chunks
3. **Lazy sanitization**: Only sanitize displayed portions
4. **Early size check**: Reject oversized emails before loading

**Implementation Notes:**

```typescript
// Check size before loading
if (emailMetadata.bodySize > 1_000_000) {
  // Enable streaming mode
  return processEmailStreaming(email);
}

// For smaller emails, use standard processing
return processEmailInMemory(email);
```

### Large Attachments (>10 MB)

**Characteristics:**

- High-resolution images or videos
- PDF documents with embedded media
- Compressed archives with many files

**Performance Impact:**

- Memory: Very High (attachment data)
- CPU: Low (validation only, not processing content)
- I/O: High (reading from storage)

**Optimizations:**

1. **Metadata-only validation**: Don't load attachment content
2. **Streaming validation**: For archives, stream decompression
3. **Progressive scanning**: Check headers before full file
4. **Async processing**: Validate attachments in background

**Implementation Notes:**

```typescript
// Validate without loading content
const validation = await validateAttachmentMetadata(attachment);
if (!validation.isValid) {
  return rejection;
}

// For archives, stream-validate without full extraction
if (isArchive(attachment)) {
  return validateArchiveStreaming(attachment);
}
```

### Large Teams (100+ Members)

**Characteristics:**

- Enterprise organizations
- Cross-functional projects
- Wide distribution lists

**Performance Impact:**

- Memory: Medium (team member metadata)
- CPU: Medium (recipient parsing and matching)
- Time: Low (linear with team size)

**Optimizations:**

1. **Team member index**: Hash map for O(1) lookup
2. **Recipient grouping**: Batch-validate recipients
3. **Lazy loading**: Load team members on-demand
4. **Cache warming**: Pre-load frequent teams

**Implementation Notes:**

```typescript
// Build index once per batch
const teamIndex = new Map(team.members.map((m) => [m.email, m]));

// O(1) lookup instead of O(n) search
const member = teamIndex.get(email);
```

### Large Histories (1000+ Emails)

**Characteristics:**

- Long-running projects
- High-volume mailing lists
- Years of archived correspondence

**Performance Impact:**

- Memory: Very High (all emails in memory)
- CPU: Very High (parsing and analyzing all)
- Time: Very High (proportional to count)

**Optimizations:**

1. **Pagination**: Process in pages of 100 emails
2. **Time windowing**: Only process recent (e.g., last 30 days)
3. **Incremental updates**: Process new emails only
4. **Aggregation**: Summarize old emails, detail recent ones

**Implementation Notes:**

```typescript
// Time-windowed processing
const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
const recentEmails = history.filter((e) => new Date(e.receivedAt) > cutoff);

// Process recent in detail, summarize old
const recentResults = await processEmailsDetailed(recentEmails);
const oldSummary = await summarizeOldEmails(history.length - recentEmails.length);

return { recent: recentResults, oldCount: oldSummary };
```

### Deep Thread Nesting (>25 Levels)

**Characteristics:**

- Long back-and-forth discussions
- Complex reply chains
- Multi-branch conversations

**Performance Impact:**

- Memory: Medium (call stack for recursion)
- CPU: Medium (traversal overhead)
- Time: High (exponential with branching)

**Optimizations:**

1. **Iterative traversal**: Avoid recursion, use queue
2. **Depth limiting**: Stop at 50 levels
3. **Breadth-first search**: Process recent branches first
4. **Pruning**: Skip irrelevant branches early

**Implementation Notes:**

```typescript
// Instead of recursion:
function processThreadRecursive(email, depth) {
  // ❌ Stack overflow risk
  if (depth > 50) return;
  processThreadRecursive(email.parent, depth + 1);
}

// Use iterative BFS:
function processThreadIterative(rootEmail) {
  // ✅ Safe for deep threads
  const queue = [{ email: rootEmail, depth: 0 }];

  while (queue.length > 0) {
    const { email, depth } = queue.shift()!;

    if (depth > 50) continue; // Depth limit

    processEmail(email);

    for (const reply of email.replies) {
      queue.push({ email: reply, depth: depth + 1 });
    }
  }
}
```

## Resource Monitoring

### Memory Monitoring

**Implementation:**

```typescript
const monitor = new MemoryMonitor();
monitor.recordBaseline();

// ... process emails ...

const memoryUsed = monitor.getMemoryDeltaMb();
if (memoryUsed > 50) {
  console.warn(`High memory usage: ${memoryUsed} MB`);
}
```

**Metrics to Track:**

- Baseline heap size
- Peak heap size during processing
- Memory per email (average)
- Memory per batch (total)
- GC frequency and duration

### Time Monitoring

**Implementation:**

```typescript
const guard = PerformanceGuard.createEmailTimeout();

// ... process email ...

if (guard.isExpired()) {
  throw new Error("Processing timeout exceeded");
}

console.log(`Time remaining: ${guard.remainingMs()}ms`);
```

**Metrics to Track:**

- Processing time per email (p50, p95, p99)
- Processing time per thread
- Timeout frequency
- Time spent in validation vs parsing vs extraction

### Throughput Monitoring

**Metrics to Track:**

- Emails processed per second
- Bytes processed per second
- Tasks extracted per minute
- Batch completion time

## Performance Testing

### Test Scenarios

1. **Baseline**: 100 emails, 1KB each, simple content
   - Expected: <1 second total, <10ms per email

2. **Large Bodies**: 100 emails, 1MB each
   - Expected: <30 seconds total, <300ms per email

3. **Large Attachments**: 10 emails, 10MB attachments each
   - Expected: <5 seconds total, <500ms per email

4. **Deep Thread**: Single thread, 50 levels deep, 200 emails
   - Expected: <30 seconds, no stack overflow

5. **High Volume**: 1,000 emails, mixed sizes
   - Expected: <5 minutes, steady memory usage

6. **Stress Test**: 10,000 emails, concurrent batches
   - Expected: Gradual degradation, no crashes

### Performance Benchmarks

| Scenario             | Target | Maximum |
| -------------------- | ------ | ------- |
| Small email (<10KB)  | 10ms   | 50ms    |
| Medium email (100KB) | 100ms  | 500ms   |
| Large email (1MB)    | 500ms  | 2s      |
| Thread (10 emails)   | 200ms  | 1s      |
| Thread (100 emails)  | 2s     | 10s     |
| Batch (100 emails)   | 10s    | 30s     |
| Batch (1000 emails)  | 60s    | 300s    |

## Optimization Checklist

- [ ] Streaming enabled for bodies >1MB
- [ ] Lazy loading for thread emails
- [ ] Incremental validation with early termination
- [ ] Batch processing with chunking (100 emails per chunk)
- [ ] LRU cache for parsed results (max 1000 entries)
- [ ] Parallel processing with concurrency limit (max 10)
- [ ] Timeout guards on all operations
- [ ] Memory monitoring with alerts
- [ ] Iterative (not recursive) thread traversal
- [ ] Content-based early rejection
- [ ] Regex backtracking limits
- [ ] Resource cleanup in error paths

## Conclusion

The Team Task Board from Emails tool is designed to handle large datasets efficiently through a combination of strict limits, streaming processing, intelligent caching, and progressive optimization. All performance constraints are enforced at the code level through guard helpers and validation.

**Last Updated:** June 18, 2026  
**Next Review:** Quarterly or after performance testing
