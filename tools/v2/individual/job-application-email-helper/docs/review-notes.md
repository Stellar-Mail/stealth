# Review Notes

## What This Contribution Adds

- Replaces generated placeholder copy with a concrete job-application email
  review contract.
- Adds synthetic fixture data for application draft states.
- Adds a zero-dependency Node test for the fixture and local rules.
- Documents setup, review flow, limitations, and future integration needs.

## Validation Performed

- `node --test tools/v2/individual/job-application-email-helper/tests/application-email-fixtures.test.mjs`

## Reviewer Focus

- This issue is limited to testing and documentation assets.
- The fixture should make future draft behavior unambiguous.
- No real applicant, recruiter, resume, or mailbox data is used.
- No production app behavior changes from this contribution.

## Follow-Up Work

- Add service code that normalizes application draft requests.
- Add UI and accessibility coverage for draft review.
- Add consent checks before any live email sending.
- Add integration tests only after a future issue allows app wiring.
