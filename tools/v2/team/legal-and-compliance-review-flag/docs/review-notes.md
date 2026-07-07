# Review Notes - Legal and Compliance Review Flag

This contribution adds folder-local testing and documentation for the Legal and
Compliance Review Flag tool. It is intentionally scoped to review fixtures,
independent test coverage, setup notes, and future implementation boundaries.

## What Changed

- Rewrote `README.md` with setup, usage, fixture shape, review steps, and known
  limitations.
- Repaired `specs.md` so it describes the V2 team tool scope without template
  placeholders.
- Added `fixtures/legal-review-items.json` with synthetic legal/compliance review
  examples and routing rules.
- Added `tests/legal-review-fixtures.test.mjs`, a zero-dependency Node test that
  validates the fixture contract.
- Added this review guide and a fuller `docs/test-plan.md`.

## What To Review

### Scope

- Every changed file should live under
  `tools/v2/team/legal-and-compliance-review-flag/`.
- There should be no imports from the main app, design system, wallet code,
  Stellar integration, database layer, routing, or inbox architecture.
- No workflow, package, or root configuration files are required.

### Fixtures

- `fixtures/legal-review-items.json` uses synthetic data only.
- Sender and requester addresses use reserved example domains.
- Review items cover privacy, contract, regulatory, marketing, employment, and
  finance scenarios.
- High-risk items include at least two human-readable signals.
- Routing rules describe the intended future mapping to legal or compliance
  owners without calling any external service.

### Tests

- Run:

  ```
  node --test tools/v2/team/legal-and-compliance-review-flag/tests/legal-review-fixtures.test.mjs
  ```

- The test should pass without installing dependencies.
- The test validates fixture shape, uniqueness, enum values, reserved domains,
  high-risk context, risk-area coverage, and routing rule coverage.

## What Is Intentionally Not Included

- No React UI, hook, service implementation, app route, or Storybook story.
- No live inbox integration or database persistence.
- No authentication, authorization, audit log, or escalation notification.
- No external legal/compliance API, LLM classifier, sender reputation lookup, or
  jurisdiction-specific policy engine.
- No legal advice or compliance decision automation.

## Follow-Up Shape

Future implementation issues can add these files inside this same folder:

- `services/legal-review-service.mjs` for deterministic validation and routing.
- `components/legal-review-flag-panel.tsx` for an isolated review queue UI.
- `hooks/use-legal-review-flag.ts` for local state around review items.
- Additional tests under `tests/` for service behavior, UI accessibility, and
  status transitions.

The first integration issue should decide how this tool receives real mail/thread
events and where approved review decisions are persisted.
