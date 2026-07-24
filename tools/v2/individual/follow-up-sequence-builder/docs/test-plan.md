# Follow-up Sequence Builder Test Plan

## Goals

- Verify sequence suggestions are explainable, editable, and deterministic.
- Guard against automatic mailbox, calendar, or email-sending side effects.
- Confirm weak-signal inputs return low confidence with warnings.
- Keep all work inside the V2 individual tool folder.

## Automated Cases

1. High-confidence critical sequence

   - Given an urgent email with a deadline and explicit follow-up request.
   - Expect 3-step critical-urgency sequence, high confidence, no warnings.

2. Medium-confidence normal sequence

   - Given an email with "follow up" and "keep me posted" but no urgency.
   - Expect medium confidence, 3-step normal-urgency sequence.

3. Low-confidence FYI context

   - Given an FYI-only newsletter with "no rush".
   - Expect low confidence, empty steps, low-priority warning.

4. No actionable signal

   - Given casual email with no follow-up language.
   - Expect low confidence, empty steps, no-signal warning.

5. Critical urgency detection

   - Given "asap" and "urgent" keywords with explicit request.
   - Expect critical urgency, 1-day first step.

6. Max steps clamping

   - Given maxSteps=2 option.
   - Expect output with at most 2 steps.

7. Duplicate warning

   - Given an existing sequence for the same sourceMessageId.
   - Expect a warning in the output.

8. Deadline-driven urgency

   - Given a deadline mention without explicit urgency keywords.
   - Expect high urgency.

9. Determinism

   - Given the same input twice.
   - Expect identical output.

10. Bounded scanning
    - Given a message exceeding MAX_SCAN_LENGTH.
    - Expect scanning to be bounded, no crash.

## Guard Cases

1. Input validation rejects null, non-objects, missing fields.
2. Size limits reject oversized subject, body, word count.
3. Sanitization strips control and zero-width characters.
4. Options validation clamps maxSteps and filters malformed entries.

## Manual Review Checklist

- Confirm warnings are returned as data, not thrown as exceptions.
- Confirm step templates are appropriate for each urgency level.
- Confirm sequence id is unique across calls (message prefix + timestamp).
- Confirm fixtures do not include real senders, message ids, or dates.

## Regression Expectations

- Adding a new urgency keyword requires one positive fixture and one
  boundary fixture.
- Adding a new step template set requires coverage for each urgency level.
- Any future inbox or calendar integration must preserve explicit user action
  before external side effects.
