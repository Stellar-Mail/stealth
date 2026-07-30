# Internal Comment Thread (V1)

Core feature engine for the internal comment thread tool. This is built as an isolated, self-contained mini-product for the V1 release, in accordance with issue #440.

## Overview

This folder contains the core logic, domain types, and deterministic fixtures for managing internal comments on entities like transactions or documents. It exposes a folder-local API surface that is not yet linked into the main app to ensure safe staging and review.

## Architecture

- **Domain Types (`types.ts`)**: Core interfaces (`User`, `Comment`, `Thread`, `ThreadWithComments`, `CommentSnippet`).
- **Fixtures (`fixtures.ts`)**: Mock data to serve as an isolated data source without requiring a live database or network calls.
- **Service Layer (`service.ts`)**: `CommentThreadService` with in-memory Maps and indexed lookups.
- **React Hook (`useCommentThread.ts`)**: Folder-local React hook that exposes the service logic to potential UI layers, managing states like `threads`, `isLoading`, and `error`.

## API Documentation

### `useCommentThread(targetId, targetType, currentUserId?)`

#### Inputs

- `targetId` (`string`): The identifier for the entity the thread is attached to.
- `targetType` (`string`): The type of entity (e.g., 'transaction').
- `currentUserId` (`string?, required for mutations): The current user's ID for authorization checks.

#### Outputs

- `threads`: Memoized array of `ThreadWithComments` (capped at 50 rendered comments per thread).
- `rawThreads`: Unmemoized full array for callers that need complete data.
- `isLoading`: `boolean` indicating if the initial fetch is happening.
- `error`: `Error | null` capturing any failures in fetching or mutating.
- `addThread(initialComment: string, authorId: string)`: Creates a new thread.
- `addComment(threadId: string, authorId: string, content: string)`: Adds a comment to a thread.
- `updateStatus(threadId: string, status: 'open' | 'resolved' | 'archived')`: Updates thread status (requires currentUserId).
- `deleteComment(threadId: string, commentId: string)`: Soft-deletes a comment (requires currentUserId).
- `refresh()`: Refetches data.

### `CommentThreadService`

#### Public Methods

- `getThread(threadId: string): Promise<ThreadWithComments | null>`
- `getThreadsForTarget(targetId: string, targetType: string): Promise<ThreadWithComments[]>`
- `createThread(targetId: string, targetType: string, initialComment: string, authorId: string): Promise<ThreadWithComments>`
- `addComment(threadId: string, authorId: string, content: string): Promise<Comment>`
- `updateThreadStatus(threadId: string, authorId: string, status: Thread["status"]): Promise<Thread>`
- `deleteComment(threadId: string, commentId: string, authorId: string): Promise<void>`

#### Constraints

- All content is validated at the service layer: max 4 000 characters, plain text only, non-empty.
- IDs are generated with `crypto.randomUUID()` to avoid collisions.
- Fixture objects are deep-cloned on initialization; mutations never touch shared references.
- Thread lookups by target are O(1) via an internal `threadTargetIndex`.
- Each thread has a `version` field for optimistic concurrency control.
- Raw comment content is never exposed in logs or cross-boundary payloads.

## Development and Testing

- Run `vitest tools/v1/team/internal-comment-thread` to execute unit tests.
- This logic is 100% deterministic and contains no secrets.
