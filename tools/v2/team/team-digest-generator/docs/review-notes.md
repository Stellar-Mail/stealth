# Review Notes

## What This Contribution Adds

- Replaces generated placeholder copy with a concrete local product contract.
- Adds a folder-local fixture that models digest extraction from team email
  activity.
- Adds a zero-dependency Node test for the fixture and expected digest states.
- Adds a folder-local service (`digest-generator.service.mjs`) that implements
  the core digest generation logic: item classification, priority inference,
  attention detection, and summary aggregation.
- Documents setup, usage, review steps, and limitations in the tool folder.

## Core Logic

The digest generator service (`services/digest-generator.service.mjs`)
implements the following deterministic rules:

- **classifyItem**: Maps email signals to digest item types
  (`new_message`, `pending_item`, `completed_item`, `team_summary`).
- **inferPriority**: Assigns priority based on signal content
  (`high` for blocked/failed/security signals, `medium` for review signals,
  `low` otherwise).
- **requiresAttention**: Returns true when priority is high or signals contain
  action-oriented keywords.
- **buildDigestItem**: Assembles a single digest item from a raw email.
- **buildSummary**: Aggregates item counts and distinct team members.
- **generateDigest**: Orchestrates the full transform from activity array to
  structured digest.

## Validation Performed

- `node --test tools/v2/team/team-digest-generator/tests/digest-fixtures.test.mjs`
- Manual review of fixture signals against expected digest item properties.
- Confirmed the service output matches fixture expectations for all six items.

## Reviewer Focus

- The issue is intentionally limited to testing, documentation, and core logic.
- The fixture should be easy to extend when implementation code arrives.
- The expected digest items should stay traceable to source emails.
- No production app behavior should change from this contribution.

## Follow-Up Work

- Add UI components for rendering the digest surface.
- Add UX for filtering and searching digest items.
- Add security checks for shared mailbox permissions.
- Add integration tests only after a future issue allows app wiring.
