# Suspicious Sender Watchlist Test Plan

## Summary

This plan defines folder-local coverage for a shared suspicious sender
watchlist. It is intentionally scoped to
`tools/v2/team/suspicious-sender-watchlist/` and does not require app wiring.

## Goals

- Detect exact sender and domain-level watchlist hits.
- Avoid false positives for similar but distinct addresses.
- Preserve audit history for teammate changes.
- Respect expiry and suppression states.
- Keep all fixtures synthetic and safe to commit.

## Proposed test topology

```text
tools/v2/team/suspicious-sender-watchlist/
  fixtures/
    senders.fixture.ts
  services/
    watchlist.service.ts
  tests/
    watchlist.service.test.ts
    TEST_PLAN.md
```

## Unit scenarios

| Area | Scenario | Expected result |
| --- | --- | --- |
| Exact match | `fraud@example.test` exists in watchlist | High-confidence hit |
| Domain match | `any@bad-domain.test` matches domain rule | Domain hit with rule reason |
| False positive | `fraudulent@example.test` vs `fraud@example.test` | No hit |
| Case handling | `Fraud@Example.Test` | Normalized exact match |
| Expired entry | Entry review window has passed | Warning is inactive or stale |
| Suppressed entry | Teammate suppresses sender with reason | No active warning, audit preserved |
| Severity sorting | Multiple rules match | Highest severity appears first |
| Empty input | Blank sender address | Validation error |
| Audit export | Watchlist history serialized | No private mailbox content included |

## Integration scenarios

### New suspicious sender

1. Alice adds `fraud@example.test` with a high severity reason.
2. Bob opens a message from that address.
3. Verify the sender is flagged and the reason is visible.
4. Verify the warning remains inside the team tool boundary.

### Domain-level warning

1. Alice adds `bad-domain.test` as a domain watchlist entry.
2. Bob opens mail from `alerts@bad-domain.test`.
3. Verify a domain-level warning appears.
4. Verify `alerts@good-domain.test` does not match.

### Suppression workflow

1. A sender is flagged.
2. A teammate suppresses the entry with a review reason.
3. The same sender is checked again.
4. Verify the active warning is suppressed and the audit trail records who did it.

## Manual review checklist

- [ ] Warning text identifies whether the match is sender-level or domain-level.
- [ ] Severity and reason are visible to team users.
- [ ] Suppression requires a reason.
- [ ] Expired entries are clearly stale.
- [ ] Keyboard users can inspect warning details.
- [ ] No fixture contains real sender addresses or production mailbox data.

## Known limitations

- Realtime team synchronization should be added only in a future integration issue.
- External threat-intelligence ingestion is out of scope for the isolated V2 tool.
- UI and accessibility tests should be added when components are implemented.
