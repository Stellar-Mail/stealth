# Email Ownership Tracker

Email Ownership Tracker is an isolated V1 team tool workspace for viewing and
changing message ownership across a shared team inbox workflow.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/team/email-ownership-tracker/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Reviewer Setup

Run the folder-local contract test from the repository root:

```bash
node tools/v1/team/email-ownership-tracker/tests/ui-contract.test.mjs
```

No app mount, live inbox data, or package installation is required for this
review.

## UI Workflow

1. Show empty, loading, error, and ready ownership states.
2. Summarize unassigned, owned, stale, and resolved messages.
3. Let reviewers filter ownership rows by state.
4. Provide keyboard-accessible claim, transfer, and release actions.
5. Keep all UI code folder-local until a future integration issue wires the tool.

## Documentation Map

- `components/` contains the isolated React UI surface.
- `fixtures/sample-ownership.json` contains deterministic synthetic examples.
- `docs/ACCESSIBILITY.md` documents keyboard, focus, and screen-reader behavior.
- `docs/VISUAL_STYLE.md` documents the local visual treatment.
- `tests/ui-contract.test.mjs` validates fixture and accessibility contracts.

## Known Limitations

- This contribution does not connect to the main shared inbox.
- Ownership actions are exposed as callbacks only.
- Persistence, notifications, auth, wallet, Stellar, and mailbox integration are
  out of scope.
