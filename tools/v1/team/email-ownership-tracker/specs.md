# Email Ownership Tracker Specs

## Purpose

Track ownership for shared mailbox threads so teammates can avoid duplicate
responses and see who is responsible for the next action.

## Scope

- Release tier: V1
- Audience: team
- Folder ownership: `tools/v1/team/email-ownership-tracker/`

This issue implements only the isolated core engine. Main app integration,
database persistence, routing, and UI mounting are out of scope.

## Inputs

`OwnershipTrackerService` accepts deterministic seed threads:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | Yes | Stable thread identifier |
| `subject` | string | Yes | Public-safe thread title for review |
| `sender` | string | Yes | Synthetic sender address in fixtures |
| `status` | `unassigned`, `assigned`, `released` | Yes | Current ownership state |
| `ownerId` | string or null | Yes | Current teammate id when assigned |
| `ownerName` | string or null | Yes | Current teammate display name |
| `updatedAt` | string | Yes | ISO timestamp supplied by the caller |

## Outputs

- Claiming returns the updated `OwnershipThread`.
- Releasing returns the updated `OwnershipThread`.
- Listing and lookup methods return defensive copies.
- Ownership events are kept in memory for folder-local review.

## Error States

- Missing `threadId`, teammate id, teammate name, or timestamp throws an error.
- Unknown thread id throws an error.
- Claiming a thread owned by another teammate throws an error.
- Releasing a thread without ownership throws an error.
- Releasing a thread owned by another teammate throws an error.

## Loading States

The core service is synchronous by design. Future hooks or UI components can add
loading and retry states when this engine is connected to persistence or live
mailbox data.

## Safety Notes

- No network calls.
- No secrets or production data.
- No app-wide imports.
- No main application wiring.
