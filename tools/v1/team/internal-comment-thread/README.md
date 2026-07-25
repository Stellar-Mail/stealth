# Internal Comment Thread (V1)

Core feature engine for the internal comment thread tool. This is built as an isolated, self-contained mini-product for the V1 release, in accordance with issue #440.

## Overview

This folder contains the core logic, domain types, and deterministic fixtures for managing internal comments on entities like transactions or documents. It exposes a folder-local API surface that is not yet linked into the main app to ensure safe staging and review.

## Architecture

- **Domain Types (`types.ts`)**: Core interfaces (`User`, `Comment`, `Thread`, `ThreadWithComments`).
- **Fixtures (`fixtures.ts`)**: Mock data to serve as an isolated data source without requiring a live database or network calls.
- **Service Layer (`service.ts`)**: A mocked backend service (`CommentThreadService`) with simulated network latency to test loading and error states properly.
- **React Hook (`useCommentThread.ts`)**: Folder-local React hook that exposes the service logic to potential UI layers, managing states like `threads`, `isLoading`, and `error`.

## API Documentation

### `useCommentThread(targetId, targetType)`

#### Inputs

- `targetId` (`string`): The identifier for the entity the thread is attached to.
- `targetType` (`string`): The type of entity (e.g., 'transaction').

#### Outputs

- `threads`: Array of `ThreadWithComments`.
- `isLoading`: `boolean` indicating if the initial fetch is happening.
- `error`: `Error | null` capturing any failures in fetching or mutating.
- `addThread(initialComment: string, authorId: string)`: Creates a new thread.
- `addComment(threadId: string, authorId: string, content: string)`: Adds a comment to a thread.
- `updateStatus(threadId: string, status: 'open' | 'resolved' | 'archived')`: Updates thread status.
- `refresh()`: Refetches data.

#### Loading and Error States

- Initial load triggers `isLoading = true`.
- Network errors or missing data (e.g., "Author not found") will be caught, setting `error` state, and the promise will reject for caller-level handling.

## Development and Testing

- Run `vitest tools/v1/team/internal-comment-thread` to execute unit tests.
- This logic is 100% deterministic and contains no secrets.
