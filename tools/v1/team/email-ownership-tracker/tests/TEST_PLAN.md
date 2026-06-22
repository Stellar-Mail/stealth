# Email Ownership Tracker Test Plan

## Summary

This folder-local test plan defines the expected coverage for ownership history
behavior. It is intentionally scoped to
`tools/v1/team/email-ownership-tracker/` so contributors can validate the tool
without touching the main app.

## Goals

- Track the current owner for a message or thread.
- Preserve an audit trail for assignment, release, transfer, and timeout events.
- Prevent unauthorized teammates from mutating ownership.
- Keep fixtures fake, deterministic, and safe to commit.

## Proposed test topology

```text
tools/v1/team/email-ownership-tracker/
  fixtures/
    ownership.fixture.ts
  services/
    ownership.service.ts
  tests/
    ownership.service.test.ts
    TEST_PLAN.md
```

## Unit scenarios

| Area | Scenario | Expected result |
| --- | --- | --- |
| Assignment | Alice claims unassigned message M1 | Alice becomes owner |
| Duplicate assignment | Bob claims M1 while Alice owns it | Operation is rejected |
| Release | Alice releases M1 | M1 becomes unassigned with release event |
| Transfer | Alice transfers M1 to Bob | Bob becomes owner, audit records both users |
| Unauthorized release | Bob releases Alice-owned M1 | Operation is rejected |
| Stale owner | Alice exceeds stale threshold | State marks ownership stale but keeps audit history |
| Thread scope | Alice owns thread T1 | All T1 messages inherit owner unless overridden |
| Message override | Bob owns message M2 in T1 | M2 owner is Bob, thread owner remains Alice |
| Audit export | Ownership history is serialized | External payload fields are excluded |

## Integration scenarios

### Claim and handoff

1. Alice claims message M1.
2. Bob attempts to claim M1 and is rejected.
3. Alice transfers ownership to Bob.
4. Bob claims responsibility successfully.
5. Verify audit history contains claim, rejected claim, and transfer events.

### Release and reclaim

1. Alice claims thread T1.
2. Alice releases T1.
3. Bob claims T1.
4. Verify current owner is Bob and the release event is preserved.

### Stale owner warning

1. Alice claims M1.
2. The fixture clock advances beyond the stale threshold.
3. Bob opens M1.
4. Verify Bob sees a stale-owner warning and can request handoff.

## Manual review checklist

- [ ] Current owner is visible in the message/thread context.
- [ ] Handoff and release states are clear to keyboard users.
- [ ] Stale ownership is warning-level unless the future policy says otherwise.
- [ ] Audit history does not expose private sender content to external payloads.
- [ ] All fixture users and message ids are synthetic.
- [ ] No root-level tests or app integration files are modified.

## Known limitations

- Durable storage is not selected yet.
- Thread-level vs message-level precedence should be confirmed by maintainers
  before implementation.
- UI accessibility tests should be added only after UI components exist.
