# Test Plan

Folder-local test strategy for the Shared Team Inbox tool.

> Tests will be written as `.test.ts` files alongside the source implementation. This document defines the plan and coverage expectations.

---

## Test Strategy

| Layer           | Scope                                                           | Framework        |
| --------------- | --------------------------------------------------------------- | ---------------- |
| **Unit**        | Services, storage adapters, and utility functions in isolation  | Vitest           |
| **Integration** | Multi-step workflows using the in-memory storage adapter        | Vitest           |
| **Manual**      | UI behavior, visual regression, accessibility, end-to-end flows | Review checklist |

---

## Unit Test Scenarios

### Message ingestion

- New message from relay is stored with normalized fields.
- Duplicate message (same delivery proof hash) is skipped.
- Message with missing required fields returns a validation error.

### Assignment

- Unassigned message can be claimed by a valid team member.
- Already-assigned message can be reassigned to a different member.
- Releasing an assignment returns the message to unassigned state.
- Assigning to an address not in the team roster is rejected.

### Status transitions

- Valid transition (unassigned → claimed → in-progress → awaiting-reply → resolved) succeeds.
- Invalid transition (unassigned → resolved) is rejected.
- Status change records actor and timestamp.

### Internal comments

- Comment is stored with author, body, and timestamp.
- Comment on a nonexistent message is rejected.
- Deleting own comment sets it to deleted state.
- Deleting another user's comment is rejected.

### Reply

- Reply to an existing message is sent via relay.
- Reply with empty body is rejected.
- Reply to a nonexistent message is rejected.

### Storage adapter

- Round-trip: set a value, get it back.
- GetAll returns all stored entries.
- Delete removes the entry; subsequent get returns null.
- Fresh store returns empty from getAll.

---

## Integration Test Scenarios

### Claim-and-reply workflow

1. Message from external sender is ingested.
2. Alice claims it → status becomes claimed, assignment recorded.
3. Alice adds an internal comment.
4. Alice replies → reply sent via relay, status becomes resolved.
5. Verify: stores contain expected records, activity log shows all events in sequence.

### Reassign workflow

1. Alice claims a message.
2. Bob claims the same message → Alice's assignment replaced, status stays claimed.
3. Verify: assignment store reflects Bob as assignee, activity log records both events.

### Reopen workflow

1. Message is resolved.
2. Carol reopens it → status becomes in-progress.
3. Verify: status store shows in-progress, activity log records the reopen.

---

## Manual Review Checklist

### Message feed

- [ ] Feed shows messages in reverse chronological order.
- [ ] Each message card displays: sender, subject, preview, received time, status badge, assignee.
- [ ] Filtering by status and assignee works.

### Message detail

- [ ] Full message body is displayed.
- [ ] Internal comment thread is visible below the message.
- [ ] Claim / Release button updates the UI immediately.

### Assignment

- [ ] Claim button changes to indicate assignment after claiming.
- [ ] Release button returns message to unassigned state.
- [ ] Other team members see the assignee name.

### Comments

- [ ] Comment form submits on Enter (Cmd+Enter).
- [ ] Delete button visible only on own comments.
- [ ] Deleted comments show `[deleted]` placeholder.

### Reply

- [ ] Reply sends with the shared inbox identity as From address.
- [ ] Status transitions to resolved after sending.

### Status transitions

- [ ] Status dropdown shows only valid next states.
- [ ] Changes reflected immediately in feed and detail view.

### Accessibility

- [ ] All interactive elements keyboard accessible.
- [ ] Status badges have accessible labels.
- [ ] Color is not the only status indicator (text or icon accompanies it).

---

## Validation Steps for OSS Contributors

Before opening a pull request:

1. **`bun test`** — all tests pass.
2. **`bun run tsc --noEmit`** — zero type errors.
3. **`bun run lint`** — zero warnings.
4. **All new files under `tools/v1/team/shared-team-inbox/`** — verify with `git diff --name-only`.
5. **Test plan updated** — new features add or update scenarios in this file.
