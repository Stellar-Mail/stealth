# Test Plan

## Automated Fixture Test

Run from the repository root:

```bash
node --test tools/v2/individual/job-application-email-helper/tests/application-email-fixtures.test.mjs
```

Expected result:

- the sample fixture parses as JSON
- each source request maps to one expected draft
- all local draft statuses are represented
- draft purpose and tone values stay in the local allowed sets
- missing portfolio context requires review
- missing contact consent blocks the draft

## Manual Review Checklist

1. Open `fixtures/sample-application-emails.json`.
2. Confirm all candidates, companies, and requests are synthetic.
3. Confirm each expected draft has a traceable `sourceRequestId`.
4. Confirm `docs/review-notes.md` documents out-of-scope sending behavior.
5. Confirm no files outside
   `tools/v2/individual/job-application-email-helper/` changed.

## Edge Cases Covered

- complete referral outreach draft
- cold application draft missing portfolio context
- blocked draft missing contact consent
- sent-sample follow-up with complete evidence

## Future Integration Tests

When implementation code is added, add tests for:

- resume and portfolio field extraction
- consent prompts before sending
- attachment presence validation
- duplicate application detection
- follow-up scheduling and audit logging
