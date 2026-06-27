# Multi-Agent Assignment

Multi-Agent Assignment is an isolated V2 team tool for routing inbox threads to
multiple collaborators. It supports manual assignment, smart auto-routing based
on agent specialties and workload balancing, and an audit trail of all actions.
It is not wired into the main mail app yet; this folder captures the complete
tool until a future integration issue connects it.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/multi-agent-assignment/
```

Do not modify the main application shell, dashboard layout, routing, inbox
architecture, wallet core, Stellar integration, database schema, or shared
design system from this issue.

## Review Map

- `types/index.ts` defines all data types and contracts.
- `services/assignment.service.ts` implements the assignment engine with in-memory state.
- `hooks/use-multi-agent-assignment.ts` bridges the service to React state.
- `components/` provides the assignment workspace UI.
- `index.ts` is the public barrel export.
- `fixtures/multi-agent.fixtures.ts` provides deterministic seed data for tests.
- `tests/assignment.test.ts` contains executable Vitest unit tests.
- `tests/test-plan.md` documents all test scenarios.
- `docs/review-notes.md` gives maintainers a review checklist.
- `ARCHITECTURE.md` is the folder-local architecture contract.

## Intended Behavior

The tool provides multi-agent thread assignment for team inboxes:

- **Assign** one or more agents to a thread manually.
- **Unassign** agents from threads with workload tracking.
- **Auto-route** threads to the best-matching active agent by specialty and workload.
- **Resolve** threads, clearing assignments and decrementing workloads.
- **Track** all actions in an assignment audit log.
- **Simulate** incoming threads for demo and testing.

All state is in-memory with no persistence. The demo harness (`demo.tsx`) provides
a self-contained development environment.

## Known Limitations

- No persistence — the store is in-memory arrays.
- No authentication or authorization — any caller can perform any operation.
- No integration with the main application's inbox or team models.
- No shared design system — uses inline styles for isolation.
- No real-time or multi-user collaboration support.

## Detailed Documentation

- [Architecture Contract](ARCHITECTURE.md) — module boundaries, data ownership, integration constraints
- [Feature Specs](specs.md) — input/output contracts and service operations
- [Technical Deep Dive](docs/ARCHITECTURE.md) — routing algorithm and data schemas
- [Accessibility Design](docs/ACCESSIBILITY.md) — a11y notes
- [Setup Guide](docs/README.md) — getting started and test commands
- [Reviewer Guide](docs/review-notes.md) — validation checklist

## Running Tests

```bash
npx vitest -c tools/v2/team/multi-agent-assignment/vitest.config.ts run
```
