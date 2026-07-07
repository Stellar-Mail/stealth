# Meeting Assignment Tool - Architecture Contract

This document defines the module boundaries, dependency rules, data flow, and future integration constraints for the Meeting Assignment Tool. The tool is a self-contained V2 team mini-product and must remain isolated in `tools/v2/team/meeting-assignment-tool/`.

## Ownership Boundary

All source, fixtures, tests, and docs for this issue stay inside:

```text
tools/v2/team/meeting-assignment-tool/
```

This tool does not modify or depend on the main application shell, dashboard layout, routing, inbox architecture, mail rendering engine, authentication, wallet core, Stellar core, database schema, or shared design system.

## Folder Structure

```text
tools/v2/team/meeting-assignment-tool/
|-- index.ts
|-- types.ts
|-- specs.md
|-- README.md
|-- fixtures/
|   |-- sample-meetings.json
|   `-- team-members.json
|-- helpers/
|   |-- performance.ts
|   `-- validation.ts
|-- services/
|   `-- meetingAssignmentService.ts
|-- tests/
|   |-- architecture-contract.test.mjs
|   |-- meeting-assignment.test.mjs
|   `-- validation.test.ts
`-- docs/
    |-- ARCHITECTURE.md
    |-- DATA_OWNERSHIP.md
    |-- SECURITY_AND_PERFORMANCE.md
    `-- review-notes.md
```

Potential future `components/` and `hooks/` modules must be added inside this folder only, and only by a UI-specific issue.

## Module Boundaries

### Public API: `index.ts`

`index.ts` is the only intended import surface for other folder-local experiments. It exports:

- `assignMeetings`
- `createMeetingAssignmentService`
- `MeetingAssignmentService`
- `MeetingAssignmentServiceConfig`
- Domain types from `types.ts`

It must not re-export fixtures, helper internals, app modules, or external providers as stable API.

### Domain Types: `types.ts`

`types.ts` owns the stable data contracts:

- `TeamMember`
- `Meeting`
- `MeetingAssignment`
- `AssignmentSummary`
- `AssignmentResult`
- `LoadState<T>`

Types are plain TypeScript contracts. They must not import runtime code, application auth state, database entities, wallet models, or live inbox types.

### Service Layer: `services/meetingAssignmentService.ts`

The service layer owns assignment behavior:

- `assignMeetings()` is the deterministic pure function.
- `createMeetingAssignmentService()` is an async wrapper for local UI development and simulated loading or error states.
- Fixture fallback data comes from this folder only.

Service rules:

- No network calls.
- No persistence writes.
- No production data reads.
- No mutations of input arrays or fixture modules.
- No imports from `src/`, app routes, inbox modules, wallet modules, Stellar modules, or other tools.

### Helper Layer: `helpers/`

Helpers are folder-local guard utilities:

- `validation.ts` sanitizes and validates meeting payloads.
- `performance.ts` keeps assignee arrays within local processing limits and chunks large lists.

Helpers may be shared inside this folder but are not the public API for external app integration.

### Fixture Layer: `fixtures/`

Fixtures provide deterministic local data for tests and demos. They are not production data and must not be mutated at runtime.

### Test Layer: `tests/`

Tests verify:

- Assignment behavior and fixture shape.
- Architecture contract, required docs, and isolation boundaries.
- Guard behavior for validation and performance helpers.

Node-compatible tests are preferred for lightweight contributor review. If a future Vitest suite remains, it must stay folder-local and avoid global app setup.

### Documentation Layer: `docs/`

Docs own contributor guidance, data boundaries, security constraints, and review checklists. Future integration details belong here until a separate integration issue explicitly allows code wiring.

## Data Flow

```text
Folder-local fixtures or caller-provided arrays
    -> assignMeetings()
    -> sorted planning pass by priority and effort
    -> skill match and capacity filter
    -> local load counter update
    -> AssignmentResult { assignments[], summary }
```

The async service wrapper adds simulated delay or simulated failure only after caller opt-in. It does not perform real fetches, writes, background jobs, notifications, or external provider calls.

## Dependency Rules

Allowed:

- Relative imports that resolve inside `tools/v2/team/meeting-assignment-tool/`.
- Node built-ins in tests.
- TypeScript type-only imports inside this folder.
- Test runner imports already scoped to local tests.

Not allowed:

- `src/` imports or aliases such as `@/`.
- Imports from sibling tools or parent directories that escape this folder.
- Main app routing, dashboard, inbox, wallet, Stellar, database, or design-system modules.
- New npm dependencies for this architecture issue.
- Live network calls, secrets, production credentials, or provider SDKs.

## Future Contributor Contract

Contributors may:

- Add local tests, fixtures, and docs.
- Add future `components/` or `hooks/` modules inside this folder when scoped to a UI issue.
- Refine the assignment algorithm while keeping result shape and documented reasons compatible.
- Update validation or performance limits with matching docs and tests.

Contributors may not:

- Wire this tool into application routes, navigation, inbox views, or dashboards.
- Persist assignments to a database or browser storage.
- Connect to calendars, inbox APIs, authentication, wallet flows, Stellar transactions, or notification providers.
- Change shared design-system files or global app state.
- Modify files outside this folder for this issue.

## Review Checklist

- [ ] All changed files are under `tools/v2/team/meeting-assignment-tool/`.
- [ ] `README.md`, `specs.md`, `docs/ARCHITECTURE.md`, and `docs/DATA_OWNERSHIP.md` agree on the folder boundary.
- [ ] No imports resolve outside this folder.
- [ ] No main app routing, inbox, auth, wallet, Stellar, database, provider, or design-system wiring is introduced.
- [ ] `node --test tools/v2/team/meeting-assignment-tool/tests/architecture-contract.test.mjs` passes.
- [ ] Existing assignment behavior tests still pass.

## Acceptance Criteria Mapping

| Issue Requirement                                                                | Evidence                                                              |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Clear folder-local architecture plan                                             | This document and `specs.md`                                          |
| No main app, routing, inbox, wallet, Stellar, database, or design-system changes | Dependency rules and contract test                                    |
| Specs explain future contributor boundaries                                      | `specs.md` and Future Contributor Contract                            |
| Files changed are limited to this folder                                         | Git diff and contract test                                            |
| Self-contained mini-product review                                               | README, docs, fixtures, services, helpers, and tests are folder-local |
