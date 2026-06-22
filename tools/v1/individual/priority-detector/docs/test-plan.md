# Priority Detector Test Plan

## Goals

- Verify priority labels are conservative, explainable, and deterministic.
- Guard against over-prioritizing promotional or deceptive urgency copy.
- Confirm the detector never mutates inbox state.
- Keep all work inside the V1 individual tool folder.

## Automated Cases

1. Urgent deadline
   - Given an email with a deadline today and a direct request.
   - Expect `urgent`, high confidence, and signals naming deadline plus action.

2. High importance without immediate deadline
   - Given a direct work request due later this week.
   - Expect `high` with an explanation that avoids immediate urgency wording.

3. Normal message
   - Given a neutral update with no direct action.
   - Expect `normal` and low-risk signals.

4. Low-priority newsletter
   - Given newsletter/digest language and unsubscribe footer.
   - Expect `low` even if promotional urgency words appear.

5. Conflicting signals
   - Given "urgent" in a promotional subject but FYI body content.
   - Expect `unknown` or low confidence rather than `urgent`.

6. Security alert
   - Given account-security wording with a review request.
   - Expect `urgent` or `high` with security signal noted and no link-click
     recommendation.

7. Empty content
   - Given missing body and vague subject.
   - Expect `unknown` with an insufficient-content warning.

8. Determinism
   - Given the same message twice.
   - Expect identical priority, confidence, and signal ordering.

## Manual Review Checklist

- Confirm labels and warnings are text-visible.
- Confirm the explanation is short enough for triage surfaces.
- Confirm no archive, delete, send, reply, or label mutation occurs.
- Confirm user override behavior is documented.
- Confirm fixtures do not include real sender identities.

## Regression Expectations

- Adding a new signal requires one positive fixture and one false-positive
  fixture.
- Adding sender relationship weighting requires tests for unknown, trusted, and
  untrusted sender hints.
- Any future inbox integration must keep explicit user control before mutation.
