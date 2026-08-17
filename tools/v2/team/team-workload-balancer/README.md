# Team Workload Balancer

A self-contained UI surface for balancing workload across team members.

This tool is implemented as an isolated module and is **not connected to the main application**. It has no dependencies on application routing, authentication, inbox architecture, database schema, Stellar integration, or the shared design system.

## Visual Style Reference

This tool references the application's existing design tokens in read-only mode.

No shared design tokens are modified.

See:

- `docs/VISUAL_STYLE.md`

## Component States

The UI provides four primary states.

### Empty

Displayed when no workload assignments are available.

Provides guidance for creating or loading assignments.

### Loading

Displays skeleton placeholders while workload data is being prepared.

Loading containers expose:

- `aria-busy="true"`

### Error

Displays an accessible error message together with a retry action.

The container uses:

- `role="alert"`

### Success

Displays:

- workload summary
- team member list
- workload indicators

## Accessibility

Accessibility considerations include:

- semantic HTML
- keyboard navigation
- visible focus indicators
- screen reader support
- descriptive labels
- WCAG AA contrast

See:

- `docs/ACCESSIBILITY.md`

## Local State Management

The UI uses a folder-local hook:

```
hooks/use-workload-balancer.ts
```

The hook manages local UI state only.

No external services or application state are modified.

## Running Tests

Run the folder-local tests:

```bash
bun test tools/v2/team/team-workload-balancer
```

Current tests cover:

- contract validation
- security validation
- workload balancing logic

Future UI interaction tests may be added as the tool evolves.

## Folder Structure

```text
tools/v2/team/team-workload-balancer/
├── components/
├── docs/
├── fixtures/
├── hooks/
├── services/
├── tests/
├── README.md
└── specs.md
```

## Ownership Boundary

All work for this tool must remain inside:

```text
tools/v2/team/team-workload-balancer/
```

Do not integrate this tool with:

- application routing
- dashboard
- inbox architecture
- authentication
- Stellar integration
- database schema
- shared design system

unless a future issue explicitly allows it.

## Follow-Up

Suggested future work:

- connect to live workload data
- integrate with the application dashboard
- persist workload assignments
- synchronize with mailbox activity

These integrations are intentionally outside the scope of this issue.

## Contributor Notes

Reviewers should verify that:

- all implementation remains inside the tool folder
- accessibility documentation is complete
- visual style documentation reflects the implementation
- the UI remains isolated from the main application
- no shared application code has been modified
