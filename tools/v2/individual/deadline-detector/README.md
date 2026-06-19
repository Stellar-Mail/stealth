# Deadline Detector

Deadline Detector is an isolated V2 individual tool workspace for detecting
likely due dates in message content before a future inbox or reminder
integration.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/individual/deadline-detector/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Reviewer Setup

This issue adds folder-local UI components, a deterministic detection service,
synthetic fixtures, and a standalone Node test. No app install is required to
review the fixture contract.

Run from the repository root:

```bash
node --test tools/v2/individual/deadline-detector/tests/deadline-fixtures.test.mjs
```

The test validates synthetic sample messages and expected deadline states.

## Tool Workflow

1. Accept message-like input through local `DeadlineMessage` objects.
2. Detect ISO dates, US dates, relative phrases such as today/tomorrow/next
   week, and simple 24-hour times.
3. Classify each result as `detected`, `needs-review`, `missed`, or `ignored`.
4. Rank urgent results first while preserving ambiguous rows for manual review.
5. Offer UI actions for review or reminder creation without creating reminders
   automatically.

## UI Surface

The folder-local React components cover:

- empty state when no message sample is available
- loading state with `aria-busy` and screen-reader status text
- error state with retry affordance
- success state with summary metrics, keyboard-accessible status filters, and
  result cards
- action buttons for reminder creation and manual review callbacks

The components are exported from `components/index.ts` and the folder entrypoint
`index.ts`.

## Fixture Coverage

`fixtures/sample-deadline-messages.json` includes synthetic examples for:

- high-confidence renewal deadline
- high-confidence relative due date
- ambiguous deadline-like request that needs review
- already missed deadline
- ignored newsletter/digest content

No real sender, mailbox, or personal data is used.

## Documentation Map

- `specs.md` defines scope, status rules, and the local detection contract.
- `docs/ACCESSIBILITY.md` documents keyboard, focus, and screen-reader behavior.
- `docs/VISUAL_STYLE.md` documents the local visual treatment.
- `docs/TEST_PLAN.md` lists automated and manual review checks.
- `tests/deadline-fixtures.test.mjs` validates the fixture contract.

## Known Limitations

- This contribution does not register the tool in app routing.
- The detector is intentionally deterministic and conservative.
- Live email ingestion, reminder writes, calendar writes, notification delivery,
  and database persistence remain out of scope.
