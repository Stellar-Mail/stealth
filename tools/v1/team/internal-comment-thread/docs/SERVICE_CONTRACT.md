# Internal Comment Thread Service Contract

## Inputs

The folder-local service accepts:

- `teamRoster`: authorized team addresses
- `target`: `{ kind: "message" | "thread", id: string }`
- `author`: authorized team member address
- `body`: team-only comment text
- optional `createdAt` timestamp for deterministic tests

All values are treated as untrusted until normalized by the service.

## Outputs

`addComment`, `listComments`, and `updateComment` return internal comment records with:

- `id`
- `target`
- `author`
- `body`
- `createdAt`
- `updatedAt`
- `deletedAt`
- `visibility: "team-only"`

`deleteComment` soft-deletes a comment so regular lists omit it. `buildExternalSafeSummary`
returns only target metadata, internal comment count, and latest internal comment timestamp. It
never includes comment body text.

## Loading and Error States

The service is synchronous and pure. Future hooks should represent:

- `loading`: caller is fetching sanitized target metadata or comments from a future adapter
- `ready`: comments were normalized and listed successfully
- `empty`: no comments exist for the selected target
- `error`: `InternalCommentError` describes validation, authorization, or ownership failure

The service does not fetch, persist, retry, schedule work, write logs, or call external delivery
paths.

## Non-Negotiable Visibility Rule

Internal comment body text must never appear in any external reply, forward, notification, header,
log, or payload. External-facing helpers may expose counts and timestamps only.

## Safety And Performance

- Only authorized team roster members can add, update, or delete comments.
- Authors can update and delete their own comments only.
- Message and thread targets remain isolated by target kind and ID.
- Comment bodies are bounded to 4,000 characters.
- Each target is capped at 500 active comments for the local in-memory reference behavior.
- Fixtures use `.test` domains and synthetic IDs only.
