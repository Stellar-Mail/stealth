# Priority Detector

Detect message priority signals in a V1 individual workspace.

## Scope

- Release tier: V1
- Audience: individual
- Folder ownership: `tools/v1/individual/priority-detector/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

## Purpose

Help an individual user triage email by surfacing priority hints with readable
reasoning and conservative fallbacks.

## Functional Contract

- Input: normalized email subject, body, sender display/address, received time,
  and optional thread metadata.
- Output: one priority review model.
- The review model should include:
  - `priority`
  - `confidence`
  - `signals`
  - `explanation`
  - `warnings`
  - optional `suggestedReviewBy`
- The detector must be deterministic for the same input.
- If signals conflict, return `unknown` or a lower confidence result.
- The detector must not mutate inbox state.

## Signal Categories

- Deadline or time-window language.
- Direct request or explicit action requirement.
- Sender relationship hint supplied by caller.
- Escalation terms such as outage, failed payment, security, or legal notice.
- Low-priority terms such as newsletter, digest, FYI, receipt, or promotion.

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## UI And Accessibility Expectations

- Priority labels must be visible as text, not color alone.
- Signal explanations should be short and scannable.
- Users must be able to override or ignore the classification.
- Confidence and warning text must be keyboard and screen-reader reachable.

## Security And Performance Expectations

- No automatic archive, delete, label, send, or reply action.
- No external model or service call is required for baseline tests.
- Parsing and scoring must be bounded for long email bodies.
- Fixtures must use synthetic senders and content only.

## Testing Expectations

See:

- `docs/test-plan.md`
- `docs/fixtures.md`
