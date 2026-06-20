# Important Email Pinning

Define important-email pinning behavior in a V1 individual workspace.

## Scope

- Release tier: V1
- Audience: individual
- Folder ownership: `tools/v1/individual/important-email-pinning/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

## Purpose

Help an individual user keep critical emails visible through explicit,
reversible pinning while avoiding automatic mailbox mutation.

## Functional Contract

- Input: normalized email summary objects and optional existing pin records.
- Output: a pin review model plus updated in-memory pin records.
- A pin record should include:
  - `messageId`
  - `state`
  - `reason`
  - `createdAt`
  - optional `expiresAt`
  - optional `source`
- Pinning the same message twice must not create duplicate active records.
- Expired pins should be visible as expired or filtered by an explicit view
  option.
- The tool must be deterministic for the same inputs and current time.
- The tool must not archive, delete, label, forward, reply, send, or mark email
  read without a future integration issue and explicit user action.

## Signal Categories

- User-selected pin action.
- User-provided reason such as deadline, invoice, travel, legal, security, or
  family.
- Optional expiry or reminder time.
- Message metadata used only for display and sorting.
- Importance hints are advisory and must not pin automatically.

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## UI And Accessibility Expectations

- Pin and unpin controls must be keyboard reachable.
- Pinned state must be visible as text or accessible label, not color alone.
- Pinned lists should have stable sorting and no layout shift when toggling.
- Users must be able to view, edit, or clear a pin reason.
- Expired pins need a clear visual and text state.

## Security And Performance Expectations

- Do not mutate the mailbox in baseline tests.
- Do not send pinned metadata to external services in baseline tests.
- Do not store full message bodies when a summary is enough.
- Sorting and duplicate detection must be bounded for large message lists.
- Fixtures must use synthetic messages and senders only.

## Testing Expectations

See:

- `docs/test-plan.md`
- `docs/fixtures.md`
