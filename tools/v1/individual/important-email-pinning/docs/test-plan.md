# Important Email Pinning Test Plan

## Goals

- Verify pinning is explicit, reversible, and deterministic.
- Guard against automatic archive, delete, label, send, or read-state changes.
- Confirm duplicate and expired pins are handled predictably.
- Keep all work inside the V1 individual tool folder.

## Automated Cases

1. Manual pin
   - Given an unpinned message and an explicit pin action.
   - Expect one active `pinned` record with message id, reason, and timestamp.

2. Manual unpin
   - Given an active pin and an explicit unpin action.
   - Expect the active pin removed or marked `unpinned` without mailbox mutation.

3. Duplicate pin prevention
   - Given the same message pinned twice.
   - Expect one active record with stable state, not two duplicate entries.

4. Expired pin
   - Given a pin with `expiresAt` before the current time.
   - Expect `expired` state or explicit filtering in the active pinned view.

5. Sort order
   - Given multiple pins with different creation and expiry times.
   - Expect deterministic ordering by active state, expiry urgency, and created
     time.

6. Advisory importance hint
   - Given a message that looks urgent but has no user pin action.
   - Expect no automatic pin.

7. Empty input
   - Given no messages or pin records.
   - Expect an empty pinned result without errors.

8. Accessibility state
   - Given a pinned message row.
   - Expect text-visible state and keyboard-reachable unpin/edit controls.

## Manual Review Checklist

- Confirm pin/unpin controls have accessible names.
- Confirm pinned state is not communicated by color alone.
- Confirm toggling a pin does not move unrelated content unexpectedly.
- Confirm no archive, delete, label, send, reply, or read-state mutation occurs.
- Confirm fixtures do not include real message ids, senders, or personal data.

## Regression Expectations

- Adding a new sort criterion requires a deterministic multi-pin fixture.
- Adding reminder or expiry behavior requires active and expired fixtures.
- Any future inbox integration must preserve explicit user action before
  mailbox mutation.
