# Collision Detection OSS Review Notes

This document gives maintainers and OSS contributors a fast way to review the
testing and documentation pass for the Collision Detection tool.

## What this PR adds

| Deliverable | Location |
| --- | --- |
| Setup guide | `docs/SETUP.md` |
| Test plan | `tests/TEST_PLAN.md` |
| Review notes | `docs/REVIEW_NOTES.md` |
| README links | `README.md` |

No file outside `tools/v1/team/collision-detection/` is part of this change.

## Review checklist

```bash
# Should return no files outside the collision-detection folder
git diff --name-only | grep -v "tools/v1/team/collision-detection/"
```

- [ ] Documentation explains how to review the tool independently.
- [ ] Test plan covers duplicate response prevention and ownership handoff.
- [ ] No production mailbox, wallet, Stellar, or database configuration is introduced.
- [ ] No main app routing, shell, authentication, or inbox code is touched.

## Core behavior to validate later

Collision Detection should prevent two teammates from responding to the same
external message at the same time without blocking legitimate handoffs or
unrelated new messages from the same sender.

The future service layer should make these decisions from local inputs:

- source message id or thread id
- current responder identity
- draft state and timestamp
- ownership or handoff record
- resolution status

## Out of scope for this PR

- UI components
- realtime transport
- app-wide route registration
- persistence adapters
- Stellar or wallet integration
- root-level tests

## Follow-up implementation notes

When code is added, prefer pure functions first:

```ts
detectCollision(threadState, proposedResponder)
```

That API shape makes the safety logic easy to test without a browser, server,
wallet, or live inbox connection.
