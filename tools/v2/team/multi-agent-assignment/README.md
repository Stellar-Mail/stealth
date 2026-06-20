# Multi-Agent Assignment - Tool Workspace

This folder is the isolated workspace for the Multi-Agent Assignment tool, built under the **V2 Tooling Release Tier**.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/multi-agent-assignment/
```

Do not modify the main application shell, dashboard layout, navigation system, authentication, wallet core, mail rendering engine, existing inbox architecture, existing routing, Stellar integration core, database schema, or existing design system. This tool must remain isolated unless a future integration issue explicitly allows it.

---

## Workspace Structure

- **[types/index.ts](file:///home/henry/projects/open-source/stealth/tools/v2/team/multi-agent-assignment/types/index.ts)**: Domain type declarations for the workspace.
- **[fixtures/multi-agent.fixtures.ts](file:///home/henry/projects/open-source/stealth/tools/v2/team/multi-agent-assignment/fixtures/multi-agent.fixtures.ts)**: Demo data seed models (mock collaborators & incoming threads).
- **[services/assignment.service.ts](file:///home/henry/projects/open-source/stealth/tools/v2/team/multi-agent-assignment/services/assignment.service.ts)**: Workload tracking, manual routing, and smart specialty matching logic.
- **[hooks/use-multi-agent-assignment.ts](file:///home/henry/projects/open-source/stealth/tools/v2/team/multi-agent-assignment/hooks/use-multi-agent-assignment.ts)**: State hook for React components.
- **[components/](file:///home/henry/projects/open-source/stealth/tools/v2/team/multi-agent-assignment/components/)**: Rich dashboard workspace UI views.
- **[tests/assignment.test.ts](file:///home/henry/projects/open-source/stealth/tools/v2/team/multi-agent-assignment/tests/assignment.test.ts)**: 19 unit tests checking validation limits and auto-balancing behavior.
- **[demo.tsx](file:///home/henry/projects/open-source/stealth/tools/v2/team/multi-agent-assignment/demo.tsx)**: Self-contained development harness.

---

## Detailed Documentation

- **[Setup & Getting Started Guide](file:///home/henry/projects/open-source/stealth/tools/v2/team/multi-agent-assignment/docs/README.md)**: Steps to run tests and explore fixtures.
- **[Technical Architecture Guide](file:///home/henry/projects/open-source/stealth/tools/v2/team/multi-agent-assignment/docs/ARCHITECTURE.md)**: Matcher algorithms and data schemas.
- **[Accessibility (a11y) Design](file:///home/henry/projects/open-source/stealth/tools/v2/team/multi-agent-assignment/docs/ACCESSIBILITY.md)**: Screen readers, color contrast, and keyboard maps.
- **[OSS Reviewer Guide](file:///home/henry/projects/open-source/stealth/tools/v2/team/multi-agent-assignment/docs/review-notes.md)**: Interactive testing script for validators.

---

## Validating the Tool

To run the isolated unit tests inside the workspace folder:

```bash
npx vitest -c tools/v2/team/multi-agent-assignment/vitest.config.ts run
```
