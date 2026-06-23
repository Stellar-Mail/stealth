# Escalation Tool Specs

## Purpose

Define a folder-local testing and documentation foundation for escalating team
conversations based on severity, owner, SLA risk, and review status.

## Contributor Boundary

All work for this tool must stay inside:

```text
tools/v2/team/escalation-tool/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Required Local Behavior

- Keep test plans, review notes, and fixtures inside the tool folder.
- Describe expected escalation states: `queued`, `assigned`, `escalated`,
  `resolved`, and `blocked`.
- Document setup, usage, fixtures, and known limitations.
- Provide fixture examples for normal, high-priority, blocked, and resolved
  escalation scenarios.
- Avoid live network calls, production data, and app-wide test dependencies.

## Recommended Future Structure

- `services/` for pure escalation routing rules.
- `fixtures/` for deterministic conversation examples.
- `tests/` for standalone Node tests.
- `docs/` for setup, test plan, review notes, and future integration guidance.
