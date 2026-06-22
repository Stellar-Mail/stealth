# Collision Detection Test Plan

## Summary

This folder-local plan defines how contributors should test the Collision
Detection tool once service code is added. The first reviewable milestone is a
documented plan because the folder currently contains only README/spec files.

## Goals

- Prevent duplicate teammate responses to the same external message.
- Allow explicit ownership handoff without false positive collisions.
- Keep all tests local to `tools/v1/team/collision-detection/`.
- Avoid live inbox data, secrets, wallet state, network calls, and app-wide tests.

## Proposed test topology

```text
tools/v1/team/collision-detection/
  fixtures/
    collision.fixture.ts
  services/
    collision.service.ts
  tests/
    collision.service.test.ts
    TEST_PLAN.md
```

## Unit scenarios

| Area | Scenario | Expected result |
| --- | --- | --- |
| Active responder | Alice starts a draft on message M1 | No collision for Alice |
| Duplicate responder | Bob starts a draft on M1 while Alice owns it | Collision returned |
| Same thread | Bob starts a draft on another message in thread T1 | Collision depends on thread policy |
| Handoff | Alice transfers ownership of M1 to Bob | Bob allowed, Alice warned |
| Resolved message | Bob opens a message marked resolved | No active collision |
| New topic | Same sender sends unrelated message M2 | No collision with M1 |
| Stale draft | Alice draft exceeds stale threshold | Bob receives warning, not hard block |
| Missing metadata | Thread id is absent | Service falls back to message id |

## Integration scenarios

### Parallel draft protection

1. Alice opens message M1 and starts a reply.
2. Bob opens the same message.
3. Bob attempts to start a reply.
4. Verify Bob receives a collision state with Alice as the active responder.
5. Verify no external reply payload is created for Bob.

### Handoff workflow

1. Alice owns message M1.
2. Alice creates an explicit handoff to Bob.
3. Bob starts a draft for M1.
4. Verify Bob is allowed.
5. Verify Alice is shown a passive warning if she tries to continue editing.

### False positive guard

1. Alice owns message M1 from sender S1.
2. Sender S1 sends a new unrelated message M2.
3. Bob opens M2.
4. Verify M2 is not blocked by M1 ownership.

## Manual review checklist

- [ ] Collision warning names the active teammate.
- [ ] Warning explains whether the response is blocked or only stale.
- [ ] Handoff state is visible and reversible before sending.
- [ ] Keyboard users can reach the warning and handoff controls.
- [ ] No collision state leaks to the external sender.
- [ ] No test fixture includes production sender data.

## Known limitations

- The policy for message-level vs thread-level locking is still open; tests
  should name which policy they assert.
- Realtime behavior needs an implementation issue with a chosen transport.
- UI and accessibility tests should be added only after components exist.
