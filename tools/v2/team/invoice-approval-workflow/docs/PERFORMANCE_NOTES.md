# Performance Notes & Large Dataset Guidelines

## Memory & Execution Benchmarks

### 1. Status Indexing
Without indexing, listing invoices filtered by status (`pending`, `approved`, `rejected`) requires an $\mathcal{O}(N)$ scan over all stored invoices. With the secondary `statusIndex` (`Map<InvoiceStatus, Set<string>>`), filtering time complexity drops to $\mathcal{O}(K)$ where $K$ is the count of matching items.

### 2. Pagination Overhead
List operations accept `PaginationOptions`:
```ts
export interface PaginationOptions {
  limit?: number; // Default: 50, Max: 100
  offset?: number; // Default: 0
}
```
This guarantees response payloads remain bounded even if the backend holds thousands of invoices.

### 3. Attachment Handling (Future Integration)
When attachments are introduced:
- Metadata (filename, mimeType, size, SHA-256 hash) should be stored, NOT raw binary blobs.
- Max attachment count per invoice: 10.
- Max individual file size: 10MB.
