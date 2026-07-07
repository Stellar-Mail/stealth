# Mail-to-Ticket Converter

Mail-to-Ticket Converter is a V2 team tool for preparing support-ticket drafts
from email evidence. This issue defines the isolated architecture contract only;
it does not connect the tool to live inboxes, ticketing systems, or the main app.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/mail-to-ticket-converter/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Architecture Map

- `specs.md` defines release tier, contributor boundaries, and module rules.
- `docs/ARCHITECTURE.md` defines components, services, hooks, tests, docs, and
  dependency direction.
- `docs/DATA_OWNERSHIP.md` documents draft ticket ownership, prohibited
  production ownership, and future adapter constraints.
- `tests/architecture-contract.test.mjs` validates that the architecture
  contract stays explicit and folder-local.

## Local Validation

Run from the repository root:

```bash
node --test tools/v2/team/mail-to-ticket-converter/tests/architecture-contract.test.mjs
```

The test is zero-dependency and does not import the main app.

## Current Limitations

- No inbox ingestion, mailbox mutation, ticket creation, ticket update,
  notification, database persistence, or external ticketing provider call is
  implemented.
- No app shell, routing, dashboard, auth, wallet, Stellar, or shared
  design-system integration is included.
- Future implementation work should build local services and fixtures first;
  app-level wiring belongs in a separate integration issue.
