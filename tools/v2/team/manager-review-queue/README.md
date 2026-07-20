# Manager Review Queue

Manager Review Queue is an isolated V2 team tool for reviewing high-risk or
policy-sensitive requests before they are approved, rejected, or escalated.
The current implementation uses deterministic local fixtures and an in-memory
service so reviewers can validate the workflow without live mail, wallet,
database, or Stellar integrations.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/manager-review-queue/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Folder Map

- `components/` - isolated React components for the queue surface.
- `services/reviewEngine.ts` - local queue fetch/update behavior backed by fixtures.
- `fixtures/` - deterministic review queue and guard payload examples.
- `guards/` - validation, sanitization, and size guards for review inputs.
- `tests/` - Node-based folder-local tests.
- `docs/` - API, security, performance, and reviewer guidance.

## Local Verification

Run the folder-local tests from the repository root:

```bash
node --test tools/v2/team/manager-review-queue/tests/review-guards.test.mjs
node --test tools/v2/team/manager-review-queue/tests/review-engine.test.mjs
```

The tests intentionally use Node's built-in runner and local fixtures only.
They do not require a browser, network access, app authentication, or a
database.

## Known Limitations

- The service uses an in-memory store and resets only within the current process.
- `MOCK_NETWORK_DELAY_MS` simulates latency; no real network request is made.
- Reviewer notes are part of the input type but are not persisted by the current
  fixture-backed service.
- Main app integration, routing, authentication, and production data loading are
  out of scope for this isolated tool.

See `specs.md` and `docs/review-notes.md` for contributor expectations and a
review checklist.
