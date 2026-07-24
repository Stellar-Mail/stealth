# Internal Comment Thread — Testing & Review Guide

This document explains how the Internal Comment Thread tool is tested and how an
OSS contributor can review it independently, without wiring it into the main
mail app. Everything referenced here stays inside
`tools/v1/team/internal-comment-thread/`.

## How to run the tests

From the repository root:

    bun x vitest run tools/v1/team/internal-comment-thread

The suite is pure, deterministic TypeScript — no network, no database, and no
secrets are required.

## What is covered

Tests live in two folder-local files:

- `service.test.ts` — happy-path behavior of `CommentThreadService`:
  - Listing threads for a target.
  - Creating a thread with its initial comment.
  - Adding a comment to an existing thread.
  - Updating a thread's status.
  - Soft-deleting a comment.
  - Rejecting thread creation for an unknown author.
- `service.edge-cases.test.ts` — error paths and edge cases that are easy to
  regress:
  - `getThread` returns `null` for an unknown thread id.
  - `getThreadsForTarget` returns an empty list when nothing matches.
  - A newly created thread is retrievable by id and by target.
  - `addComment` rejects for a missing thread and for an unknown author.
  - `addComment` validates the thread **before** the author.
  - `updateThreadStatus` rejects for a missing thread and supports `archived`.
  - `deleteComment` rejects for a missing thread and for a missing comment.
  - Separate `CommentThreadService` instances stay isolated from each other.

## Fixtures

Deterministic mock data lives in `fixtures.ts`:

- `mockUsers`: `u-1` (Alice, admin) and `u-2` (Bob, member).
- `mockThreads`: one open thread `th-1` on target `txn-123` / `transaction`.
- `mockComments`: two comments (`c-1`, `c-2`) on `th-1`.

`CommentThreadService` loads these fixtures in its constructor, so every
`new CommentThreadService()` starts from the same known state.

## Important caveat for test authors

`CommentThreadService` stores the fixture **objects by reference**. Mutating
operations (`deleteComment` sets `isDeleted`, `updateThreadStatus` sets
`status`, `addComment` touches `updatedAt`) therefore mutate the shared fixture
objects, and that state is **not** reset by creating a new service instance
within the same test file.

Because Vitest isolates module state per test file, this does not leak between
`service.test.ts` and `service.edge-cases.test.ts`. Within a single file,
though, any test that mutates `th-1`, `c-1`, or `c-2` is ordered after the
read-only tests so it cannot affect earlier assertions. New tests should follow
the same rule, or assert only on freshly created threads.

## Known limitations

- **In-memory only.** There is no durable storage; all state is lost when the
  process ends. A future integration issue will introduce a real storage
  adapter.
- **Simulated latency.** Each service call awaits a fixed 50 ms timer to model
  async behavior; timing is not meant to reflect real backends.
- **No UI/DOM tests.** Coverage targets the service layer. The
  `useCommentThread` React hook is documented in `README.md` but is not
  exercised here, since that would require a DOM/React testing environment the
  isolated tool intentionally avoids for now.
- **Flat membership.** Role-based permissions and cross-team visibility are out
  of scope per `specs.md`.

## Reviewer checklist

- [ ] Tests run green with the command above.
- [ ] No file outside `tools/v1/team/internal-comment-thread/` is changed.
- [ ] No imports from `src/`, `tools/v2/`, or sibling tool folders.
- [ ] New tests assert on freshly created threads, or are ordered after the
      read-only tests (see the caveat above).
- [ ] No comment body text is exposed on any external delivery path (the spec's
      firm rule).
