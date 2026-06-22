# Email Ownership Tracker OSS Review Notes

This document helps maintainers review the folder-local testing and
documentation pass for the Email Ownership Tracker tool.

## What this PR adds

| Deliverable | Location |
| --- | --- |
| Setup guide | `docs/SETUP.md` |
| Test plan | `tests/TEST_PLAN.md` |
| Review notes | `docs/REVIEW_NOTES.md` |
| README links | `README.md` |

No files outside `tools/v1/team/email-ownership-tracker/` are part of this
change.

## Review checklist

```bash
# Should return no files outside the ownership tracker folder
git diff --name-only | grep -v "tools/v1/team/email-ownership-tracker/"
```

- [ ] Documentation explains how to review the tool independently.
- [ ] Test plan covers assignment, release, handoff, stale owner, and audit history.
- [ ] No production mailbox, wallet, Stellar, or database configuration is introduced.
- [ ] No app-wide shell, routing, authentication, or inbox code is touched.

## Core behavior to validate later

Email Ownership Tracker should answer:

- Who currently owns this message or thread?
- When was ownership assigned?
- Was the item released, reassigned, or timed out?
- What safe audit trail can be shown to teammates?

The future service layer should use local inputs and return deterministic
ownership state without network calls.

## Out of scope for this PR

- UI components
- app route integration
- persistence adapters
- external notification delivery
- wallet or Stellar signing
- root-level test changes

## Follow-up implementation notes

Prefer a pure, testable API first:

```ts
assignOwner(ownershipState, messageRef, teammate)
releaseOwner(ownershipState, messageRef, teammate)
transferOwner(ownershipState, messageRef, fromTeammate, toTeammate)
```

That shape keeps ownership rules reviewable before the tool is connected to the
shared inbox UI.
