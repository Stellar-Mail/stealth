# Manager Review Queue

Folder-local V2 team tool for reviewing manager approval requests before they
leave the isolated tool workspace.

The current implementation includes local mock data, a deterministic review
engine, React components for queue states, security/performance guards, and
folder-local tests. It is not wired into the main application yet.

## Ownership Boundary

All work for this tool must stay inside:

```
tools/v2/team/manager-review-queue/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core,
Stellar integration, database schema, or design system unless a future integration
issue explicitly allows it.

## Folder Structure

```
manager-review-queue/
  components/                         Isolated React queue states and item list
  docs/
    ACCESSIBILITY.md                  Keyboard and screen reader guidance
    VISUAL_STYLE.md                   Local visual styling notes
    api.md                            Review engine API contract
    security-and-performance.md       Guard threat model and limits
    review-notes.md                   OSS reviewer guide
    test-plan.md                      Automated and manual validation plan
  fixtures/
    reviewFixtures.ts                 TypeScript UI/service fixtures
    sample-review-requests.json       Guard test fixtures
  guards/
    review-guards.mjs                 Pure validation and performance guards
  services/
    reviewEngine.ts                   Mock queue fetch/update service
  tests/
    documentation-contract.test.mjs   Documentation completeness checks
    review-guards.test.mjs            Executable guard tests
  types/
    index.ts                          Local TypeScript types
  README.md
  specs.md
```

## Setup

No package install is required for the guard and documentation tests. They use
Node built-ins only.

Requirements:

- Node 18 or later.
- Run commands from the repository root unless noted otherwise.

## Running Tests

From the repository root:

```
node --test tools/v2/team/manager-review-queue/tests/review-guards.test.mjs
node --test tools/v2/team/manager-review-queue/tests/documentation-contract.test.mjs
```

From this folder:

```
node --test tests/review-guards.test.mjs
node --test tests/documentation-contract.test.mjs
```

The guard tests validate field allowlists, ID safety, submitter email safety,
text sanitization, queue/history/attachment/tag size limits, and fixture-driven
hostile inputs.

The documentation contract test validates that setup, test commands, review
boundaries, known limitations, and required review notes remain discoverable.

## Usage

The local service exposes two async operations from `services/reviewEngine.ts`:

- `fetchReviewQueue(input)` returns filtered and paginated queue items from the
  local mock store.
- `updateReviewItemStatus(input)` updates a mock item status or throws when the
  item ID is unknown.

The `ManagerReviewQueue` component loads pending items, displays loading, empty,
error, success, and queue-list states, and offers approve, reject, and escalate
actions against the local mock service.

## Fixtures

- `fixtures/reviewFixtures.ts` feeds the TypeScript service and UI examples.
- `fixtures/sample-review-requests.json` feeds the guard tests with valid
  requests, hostile inputs, and sanitization edge cases.

All fixture data is local and synthetic. It does not include real users,
production inbox data, credentials, wallet values, or external service calls.

## Review Docs

- `docs/test-plan.md` lists the automated checks and manual UI/accessibility
  review path.
- `docs/review-notes.md` explains the expected OSS review scope and what is
  intentionally out of scope.
- `docs/api.md`, `docs/security-and-performance.md`, `docs/ACCESSIBILITY.md`,
  and `docs/VISUAL_STYLE.md` document existing implementation details.

## Known Limitations

- The queue service uses an in-memory mock store; it has no persistence layer.
- The UI components are isolated and are not mounted in an app route.
- Authentication, authorization, audit persistence, and notification delivery are
  future integration concerns.
- The mock service simulates latency but does not make live network calls.
- Guard sanitizers prepare values for safer handling, but renderers must still
  escape user-authored text before inserting it into HTML.

## Acceptance Checklist

- [x] Tests and test plan live inside this folder.
- [x] Documentation explains independent setup and review.
- [x] Fixtures are local and synthetic.
- [x] No files outside `tools/v2/team/manager-review-queue/` are needed.
- [x] The contribution is reviewable as a self-contained mini-product change.
