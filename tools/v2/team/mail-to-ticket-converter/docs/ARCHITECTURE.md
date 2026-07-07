# Mail-to-Ticket Converter Architecture Contract

## Purpose

Mail-to-Ticket Converter is a self-contained V2 team mini-product. It prepares
reviewable ticket drafts from email evidence so a team can triage support work
without wiring this folder into the live inbox or ticketing provider during the
architecture phase.

## Ownership Boundary

All implementation, fixtures, tests, and docs for this tool must remain inside:

```text
tools/v2/team/mail-to-ticket-converter/
```

No file outside this folder is required for this architecture issue.

## Module Boundaries

### `components/`

Responsibility: render the local ticket conversion review surface.

Planned components:

- `MailToTicketConverterShell`: local root component that receives sanitized
  email evidence or fixture data and coordinates the conversion flow.
- `TicketDraftPreview`: displays extracted title, description, priority,
  requester, assignee hint, and tags.
- `EvidenceSummaryPanel`: shows summarized source evidence without exposing
  production email bodies.
- `DuplicateTicketNotice`: presents possible duplicate ticket warnings.
- `TicketReviewActions`: presents reviewer actions such as accept draft, defer,
  reject, or mark-needs-more-evidence.

Rules:

- Components receive data from hooks or props.
- Components do not read the inbox, database, wallet, Stellar, auth, or
  ticketing provider state.
- Components do not create or update production tickets.

### `services/`

Responsibility: hold pure business logic and deterministic helpers.

Planned services:

- `emailEvidenceNormalizer`: converts caller-provided evidence into a local,
  sanitized input shape.
- `ticketDraftBuilder`: prepares ticket title, description, priority, tags, and
  requester metadata.
- `ticketConfidenceScorer`: computes confidence and review requirements.
- `duplicateTicketDetector`: flags local duplicate candidates from injected
  ticket summaries or fixtures.
- `draftReviewStateService`: models local reviewer states and transition rules.

Rules:

- Services do not import React.
- Services do not make live network calls.
- Services use injected data or local fixtures instead of fetching from the
  main app or external ticketing systems.

### `hooks/`

Responsibility: bridge component state to local services.

Planned hooks:

- `useMailToTicketDrafts`: manages draft loading, normalization, scoring, and
  review state.
- `useTicketDraftFilters`: owns local filters for priority, status, requester,
  team, and confidence.
- `useTicketReviewActions`: exposes local reviewer actions without writing to
  production ticketing systems.

Rules:

- Hooks call services instead of duplicating business logic.
- Hooks do not write to global stores or app contexts.
- Hooks do not register routes, navigation items, inbox actions, or ticketing
  provider webhooks.

### `tests/`

Responsibility: provide local confidence without requiring the main app.

Expected coverage:

- Architecture and documentation contract tests.
- Service tests for evidence normalization, draft building, confidence scoring,
  duplicate detection, and review transitions.
- Fixture tests proving all sample data is synthetic.
- Hook and component tests after implementation exists.

Rules:

- Tests must stay folder-local.
- Tests may use local fixtures and standard test utilities already present in
  the repository.
- Tests must not require a live inbox, production database, wallet, Stellar
  account, or external ticketing provider.

### `docs/`

Responsibility: explain the tool contract for future contributors.

Expected contents:

- Architecture and dependency boundaries.
- Data ownership and privacy rules.
- Review notes and test plans for future implementation issues.
- Future integration notes that describe, but do not implement, app wiring.

## Dependency Graph

```text
components/ -> hooks/ -> services/
tests/ -> docs/, fixtures/, components/, hooks/, services/
docs/ -> descriptive only
```

Components should not import services directly once hooks exist. Services should
not import components or hooks. Docs should not be imported at runtime.

## Integration Constraints

This architecture issue must not:

- Modify the main app shell, dashboard, routing, navigation, or shared layout.
- Connect to the existing inbox architecture or mail rendering engine.
- Create, update, sync, or delete tickets in any external provider.
- Add database schema, persistence, or production audit writes.
- Add authentication, wallet, Stellar, or payment behavior.
- Add notifications, webhooks, ticketing sync, or external provider calls.
- Change the shared design system.

Future integration should pass sanitized evidence and callbacks into the
folder-local shell through a thin adapter. The tool should remain the source of
truth for conversion logic, while the main app owns routing, authorization,
live mail access, persistence, ticket publishing, and provider credentials.

## Contributor Rules

May change inside this folder:

- Local components, services, hooks, tests, fixtures, and docs.
- Internal types and local data contracts.
- Architecture docs when module boundaries evolve.

Must not change in this issue:

- Files outside `tools/v2/team/mail-to-ticket-converter/`.
- Main app shell, routing, inbox, wallet, Stellar, auth, database, ticketing
  provider, or shared design-system code.
- Production data access, production ticket creation, external provider calls,
  or live network integrations.
