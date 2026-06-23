# Multi-Agent Assignment

A self-contained V2 team tool designed to manage, track, and optimize email/support thread routing to team collaborators (agents). The system balances agent workloads and matches specific domain expertise to incoming issue categories.

## Features

- **Real-Time Workload Metrics**: Monitor unassigned counts, average workloads, online collaborator status, and resolution counts.
- **Smart Routing Engine**: Automate assignment using a match-routing algorithm that evaluates incoming subject/snippet text against agent specialties, prioritizing lowest active workload to prevent bottlenecking.
- **Interactive Manual Assignment**: Manually assign and unassign multiple active collaborators to any thread.
- **Real-Time Activity Audit Log**: View sequential assignment and resolution transactions with complete attribution.
- **Inbox Mail Feed Simulator**: Inject pre-configured or fully custom mock emails into the dashboard to test the routing engine's safety, fallback logic, and workload distribution.

## Folder Structure

All work is self-contained in this directory:

```text
tools/v2/team/multi-agent-assignment/
├── types/
│   └── index.ts              # TypeScript domain types (Agent, Thread, Logs, Metrics)
├── fixtures/
│   └── multi-agent.fixtures.ts # Seed data for agents and threads
├── services/
│   └── assignment.service.ts # Core pure logic, metrics computations, and routing engine
├── hooks/
│   └── use-multi-agent-assignment.ts # React state management hook
├── components/
│   ├── AgentList.tsx         # Renders team members, statuses, workloads, and active issues
│   ├── ThreadList.tsx        # Renders mail queue, priority tiers, assign/resolve controls
│   ├── AssignmentConsole.tsx # Integrated console view with metrics, simulator & logs
│   └── index.ts              # Component public exports
├── docs/
│   ├── README.md             # This setup and usage guide
│   ├── ARCHITECTURE.md       # Technical deep dive (routing algorithm)
│   ├── ACCESSIBILITY.md      # Keyboard navigation, contrast ratios & WAI-ARIA states
│   └── review-notes.md       # OSS reviewer validation guide
├── ARCHITECTURE.md           # Folder-local architecture contract
├── specs.md                  # Feature specs and service contracts
├── tests/
│   ├── assignment.test.ts    # 19 Vitest unit tests covering service logic & routing
│   └── test-plan.md          # Test coverage documentation
```

## Getting Started

### Prerequisites

Make sure the root node packages are installed:

```bash
npm install
```

### Running Tests

To run the unit test suite in isolated mode:

```bash
npx vitest -c tools/v2/team/multi-agent-assignment/vitest.config.ts run
```

To run tests in watch mode:

```bash
npx vitest -c tools/v2/team/multi-agent-assignment/vitest.config.ts
```

### Viewing the Demo Harness

The tool remains isolated from the main application shell and routes. To test it visually during development, export the `MultiAgentAssignmentDemo` component from `demo.tsx` inside a local sandbox view or mount it during local dev servers.

## Seed Fixtures

The system seeds the workspace with:

1. **5 Collaborators**:
   - **Alice Vance** (Support Specialist): specialties in support, billing, and general tasks.
   - **Bob Chen** (Security Officer): specialties in security and compliance.
   - **Charlie Kim** (Stellar Integrations Engineer): specialties in stellar integration, technical bugs, and billing.
   - **Diana Prince** (Customer Success Lead): currently set to Busy, specialties in escalation and technical support.
   - **Evan Wright** (Junior Support Associate): currently Offline, specialties in general support.
2. **6 Preloaded Threads**:
   - Spanning high, medium, and low priorities.
   - Categorized by Stellar, Security, Billing, Technical, and General.
   - Pre-seeded with single or multiple active assignments.

## Known Limitations

- **State Persistence**: The dashboard is a client-side prototype. Thread updates, simulated tickets, and collaborator statuses are held in memory and will reset upon browser refresh.
- **Collaborator Assignment Constraint**: Only collaborators whose status is **Active** can be auto-assigned. Offline or busy collaborators are automatically skipped by the smart routing engine.
