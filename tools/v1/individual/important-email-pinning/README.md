# Important Email Pinning

V1 individual tool workspace for marking critical emails as pinned within a
reviewable local experience.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/important-email-pinning/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Architecture Contract

This mini-product is governed by folder-local architecture notes:

- `MODULE_BOUNDARIES.md` defines the component, service, hook, test, and docs boundaries.
- `DATA_OWNERSHIP.md` defines owned pin metadata, borrowed message summaries, derived data, and persistence limits.
- `INTEGRATION_CONSTRAINTS.md` defines what future contributors may and may not connect to the host app.

Future contributors should update these files before adding implementation code so the folder remains reviewable as an isolated launch tool.

## Intended Use

- Let a user pin emails that need persistent attention.
- Track pinned state, pin reason, created time, and optional expiry/reminder
  metadata.
- Keep pinned items visible without hiding unpinned messages.
- Keep the tool advisory; it must not archive, delete, label, forward, or send
  email automatically.

## Pin States

- `pinned`: visible in the pinned list and marked as important by the user.
- `unpinned`: ordinary message with no persistent pin.
- `expired`: pin is no longer active because an expiry time passed.
- `unknown`: state cannot be determined from the provided data.

## Testing Focus

Use `docs/test-plan.md` and `docs/fixtures.md` to cover manual pin/unpin,
duplicate prevention, expiry, sort order, keyboard access, false-positive
importance hints, empty input, and non-mutating behavior.
