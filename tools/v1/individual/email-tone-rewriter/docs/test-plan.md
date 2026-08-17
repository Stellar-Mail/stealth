# Email Tone Rewriter Test Plan

This folder does not contain executable tool code yet, so this document is the
folder-local test plan for issue #353. Convert each scenario below into unit or
component tests when the feature implementation lands.

## Unit Scenarios

1. Rewrites a draft into a supported tone while preserving the core request.
2. Preserves dates, names, amounts, links, and other factual details.
3. Returns a deterministic validation error for an unsupported tone.
4. Rejects empty draft body input with a validation error.
5. Applies configured length constraints without dropping required facts.
6. Separates preserved key points from the rewritten body for review.
7. Produces deterministic output for repeated rewriting of the same fixture.
8. Keeps send/save/mutate flags disabled until explicit confirmation.

## Component Scenarios

1. Shows original draft, target tone, rewritten body, and preserved key points
   before any action is available.
2. Lets the user switch tone and re-run the rewrite without changing the
   original draft.
3. Announces validation errors through accessible text associated with the tone
   or draft field.
4. Provides a non-destructive cancel path that leaves the draft untouched.

## Non-Goals for This Folder

- End-to-end compose or inbox routing.
- Database persistence.
- Real email send actions.
- External AI-provider integration.
