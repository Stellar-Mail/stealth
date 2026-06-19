# Auto Label Suggestion Test Plan

This test plan is folder-local because the tool is not integrated with the app shell yet.
It should become executable unit coverage when the first implementation lands.

## Fixture Setup

Use:

```text
tools/v1/individual/auto-label-suggestion/fixtures/email-label-cases.json
```

Each fixture contains the normalized email input and the expected labels. Future tests
should assert the returned label names first, then validate confidence and explanations.

## Scenarios

| Scenario          | Fixture                     | Expected result                                                                         |
| ----------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| Finance deadline  | `invoice-overdue`           | Suggests `Finance` and `Action needed`; reason mentions invoice and due timing.         |
| On-chain payout   | `stellar-payout`            | Suggests `Finance` and `Stellar`; preserves existing `Receipts` label.                  |
| Sign-in code      | `security-code`             | Suggests only `Security`; does not include the code value in logs or evidence.          |
| Meeting follow-up | `calendar-reschedule`       | Suggests `Calendar` and `Action needed`; evidence includes reschedule/confirm language. |
| Low-risk digest   | `newsletter-product-update` | Suggests `Newsletter`; does not add higher-priority labels.                             |

## Negative Checks

- Empty subject and snippet should return no suggestions, not a generic fallback label.
- Existing labels should not be overwritten or duplicated.
- Keyword-only matches should stay `low` confidence unless the subject or sender supports
  the same label.
- Security and Finance labels should outrank Newsletter in mixed-content emails.

## Manual Review

1. Confirm all changed files stay under `tools/v1/individual/auto-label-suggestion/`.
2. Confirm fixture examples avoid real personal data, secrets, access tokens, and live
   wallet addresses.
3. Confirm the README documents setup, usage, fixtures, and limitations.
4. Confirm future executable tests can be written from this plan without touching the
   main application.
