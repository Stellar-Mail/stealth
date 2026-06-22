# Review Notes

## What This Contribution Adds

- Replaces generated placeholder copy with a concrete unsubscribe candidate
  review contract.
- Adds synthetic fixture data for unsubscribe detection states.
- Adds a zero-dependency Node test for the fixture and local rules.
- Documents setup, review flow, limitations, and future integration needs.

## Validation Performed

- `node --test tools/v2/individual/unsubscribe-finder/tests/unsubscribe-fixtures.test.mjs`

## Reviewer Focus

- This issue is limited to testing and documentation assets.
- The fixture should make future detection behavior unambiguous.
- No real mailbox content, personal subscription data, or credentials are used.
- No production app behavior changes from this contribution.

## Follow-Up Work

- Add service code that normalizes unsubscribe candidate records.
- Add UI and accessibility coverage for user consent before any action.
- Add security and link-safety rules before live unsubscribe execution.
- Add integration tests only after a future issue allows app wiring.
