# Suspicious Sender Watchlist OSS Review Notes

This document gives maintainers a short review path for the folder-local
testing and documentation pass.

## What this PR adds

| Deliverable | Location |
| --- | --- |
| Setup guide | `docs/SETUP.md` |
| Test plan | `tests/TEST_PLAN.md` |
| Review notes | `docs/REVIEW_NOTES.md` |
| README links | `README.md` |

No file outside `tools/v2/team/suspicious-sender-watchlist/` is part of this
change.

## Review checklist

```bash
git diff --name-only | grep -v "tools/v2/team/suspicious-sender-watchlist/"
```

- [ ] Documentation explains independent review without app integration.
- [ ] Test plan covers exact sender, domain, expired, suppressed, and false-positive cases.
- [ ] No live threat feed, production mailbox data, wallet, or database config is introduced.
- [ ] No app-wide shell, routing, inbox, authentication, or design-system code is touched.

## Future behavior to validate

The watchlist should classify incoming senders from local inputs:

- sender address and normalized domain
- watchlist entries with severity, reason, and review status
- suppression or expiry metadata
- audit events for teammate edits

The first implementation should prefer pure service functions so every rule can
be tested without a browser, wallet, API, or live mailbox.
