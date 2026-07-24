# Collision Detection Engine

Core feature engine for the Collision Detection tool. Pure, deterministic, and
fully isolated inside this folder.

## Public API

Imported from the folder-local entry point (index.ts):

- `scanActiveReplies(replies, monitoredThreads)` — main entry point.
- `detectCollisions(replies)` — group replies by thread and find collisions.
- `toReadyState(result)` — map a result into a UI-friendly state.
- `COLLISION_FIXTURES`, `EMPTY_REPLIES`, `SINGLE_REPLY` — deterministic fixtures.

## Inputs

ActiveReply:

- `userId` — string identifier of the user
- `userName` — display name of the user
- `threadId` — the thread the user is replying to
- `startedAt` — ISO timestamp when reply drafting began
- `preview` — optional thread preview text

## Outputs

On success, `scanActiveReplies` returns `{ status: "ok", data: ScanResult }` where
ScanResult has:

- `events` — list of `CollisionEvent` objects detected
- `monitoredThreads` — number of threads being monitored
- `scannedAt` — ISO timestamp of the scan

## Collision Detection Logic

- Replies are grouped by `threadId`.
- Groups with fewer than 2 replies are ignored (no collision).
- Groups with 2 replies produce a `"warning"` severity event.
- Groups with 3+ replies produce a `"critical"` severity event.
- Events are assigned sequential IDs (`collision-0`, `collision-1`, ...).

## State Machine

The `CollisionDetectionState` union models every UI lifecycle:

- `idle` — no scan requested yet
- `loading` — a scan is in flight
- `ready` — scan results available (events may be empty)
- `error` — scan failed

`toReadyState` converts a `CollisionDetectionResult` into ready/error for the UI.

## Error States

`scanActiveReplies` never throws. It returns `{ status: "error", code, message }`:

- `scan-failed` — invalid reply data or negative thread count
- `unreachable` — reserved for future network-level failures

## Guarantees

- No live network calls, secrets, or production data.
- No mailbox mutation and no persistence outside this folder.
- Deterministic: the same input always produces the same output.
