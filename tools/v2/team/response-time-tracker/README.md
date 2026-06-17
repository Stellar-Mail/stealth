# Response Time Tracker

This folder is the isolated workspace for the Response Time Tracker tool.

The current core engine is a pure TypeScript service that converts supplied
message events into response-time metrics. It does not fetch live mail, call
production APIs, read secrets, or wire itself into the main app.

## Ownership Boundary

All work for this tool must stay inside:

```text
.\tools\v2\team\response-time-tracker\
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Folder-Local API

- `services/responseTimeTracker.ts` exposes `summarizeResponseTimes`,
  `safeSummarizeResponseTimes`, and loading/error state helpers.
- `tests/responseTimeTracker.test.ts` covers deterministic fixture behavior.
- `docs/api.md` documents inputs, outputs, loading states, error states, and the
  no-network boundary.

## Verification

```bash
npx vitest run tools/v2/team/response-time-tracker/tests/responseTimeTracker.test.ts
```

See `specs.md` for the issue categories and contributor expectations.
