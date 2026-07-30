# Internal Comment Thread — Safety & Performance Constraints

These constraints are **hard requirements** before this tool touches the main application shell, mail engine, routing, or any external delivery path.

## 1. Data Integrity & Isolation

### 1.1 Immutable Fixtures
**Current violation (service.ts:13-20):** `initializeWithFixtures` stores fixture objects by reference into Maps. Mutating operations (`updateThreadStatus:118`, `deleteComment:130-131`) mutate the shared fixture objects, causing flaky cross-test state.

**Constraint:** All fixture objects must be deep-cloned before insertion into service Maps. No service method may mutate objects obtained from `Map.get()` directly; mutations must occur on fresh copies and then be written back via `Map.set()`.

### 1.2 Collision-Safe ID Generation
**Current violation (service.ts:57,71; InternalCommentThread.tsx:54):** IDs are generated via `Date.now()`, producing collisions under concurrent operations or sub-millisecond timing.

**Constraint:** Replace `Date.now()` ID generation with a collision-resistant scheme (crypto.randomUUID(), UUID v4, or a monotonic counter with thread-local state).

### 1.3 Ownership & Authority Checks
**Current gap (service.ts:45-55,83-109):** `createThread` and `addComment` validate author existence, but `updateThreadStatus` and `deleteComment` never verify the caller is the original author or a team admin.

**Constraint:**
- `updateThreadStatus` must reject status changes from non-admin authors unless the authorId owns the thread.
- `deleteComment` must reject deletions from authors other than the comment author.
- Enforce these checks on the service layer, not the UI layer.

### 1.4 Content Boundaries
**Current gap (service.ts:45-80,83-109):** No maximum length, no sanitization, and no plain-text enforcement on comment `content` or `initialComment`.

**Constraint:**
- Reject `content` / `initialComment` longer than 4 000 characters at the service layer.
- Strip or reject HTML/markup before storage; store as plain text.
- Reject empty strings (trim check must live in `service.addComment`, not only the UI).

## 2. Injection & Leak Prevention

### 2.1 Comment Body Isolation
**Current risk:** Although no external delivery path exists yet, the service layer exposes full `ThreadWithComments` objects containing raw `content` strings via `getThread` and `getThreadsForTarget`.

**Constraint:**
- Introduce a `CommentSnippet` type (max 200 chars, truncated) for any surface that crosses the team boundary (logs, exports, API responses to the shell).
- The raw `content` field must never appear in logs, telemetry, or any payload that crosses the module boundary.

### 2.2 No Unused React Imports
**Current violation (InternalCommentThread.tsx:1):** `useEffect` is imported but never used.

**Constraint:** Remove unused imports before integration; lint must pass with zero warnings in this folder.

## 3. Performance

### 3.1 Indexed Lookups Instead of Linear Scan
**Current violation (service.ts:36-42):** `getThreadsForTarget` iterates all threads in a `for...of` loop (O(n)).

**Constraint:** Maintain a `Map<string, Set<string>>` (targetId -> Set of threadIds) updated on every mutation, so retrieval is O(1) for target selection.

### 3.2 Remove Fixed Latency From Hot Paths
**Current violation (service.ts:26,34,51,84,113,123):** Every method awaits a fixed 50ms `setTimeout`.

**Constraint:**
- Remove the artificial 50ms delay from all service methods.
- If latency simulation is needed for tests, move it into test helpers only (e.g., `test-utils.ts`), not production code.

### 3.3 Pagination & Bounds
**Current gap (service.ts:25-43):** `getThread` and `getThreadsForTarget` return unbounded arrays.

**Constraint:**
- Enforce a hard `MAX_COMMENTS_PER_THREAD = 500` cap; return the newest 500 and expose `hasMore` to callers.
- Enforce a hard `MAX_THREADS_PER_TARGET = 100` cap in `getThreadsForTarget`.

### 3.4 Hook Stability
**Current gap (useCommentThread.ts:1-93):** `useCommentThread` recreates callbacks on every render because `useCallback` dependencies include state setters; no memoization prevents redundant re-renders when `threads` grows large.

**Constraint:**
- Memoize list transformations; cap rendered comment items to the first 50 in the UI layer.
- Use `useMemo` for thread list computations; avoid spreading entire thread objects on every `addComment` when only one thread changes.

## 4. Concurrency & Consistency

### 4.1 Optimistic Concurrency Control
**Current risk (service.ts:102-104, useCommentThread.ts:49-59):** Concurrent mutations to the same thread could lose updates (no version check).

**Constraint:** Add an `version: number` field to `Thread`; reject writes whose `version` does not match the current Map value, forcing the caller to refresh and retry.

## 5. Testing & Verification Requirements

Before any integration PR is approved:
- Lint passes with zero warnings in `tools/v1/team/internal-comment-thread/**` and `src/tools/v1/team/internal-comment-thread/**`.
- Vitest passes with no skipped tests.
- Add a concurrency test: parallel `addComment` calls to the same thread must not lose writes.
- Add a mutation test: `getThreadsForTarget` must not reflect fixture mutations across test cases.
- Add a security test: comment bodies > 4 000 chars, HTML strings, and empty strings must be rejected by `service.addComment` and `service.createThread`.
