# Email Template Library

This folder is the isolated workspace for the Email Template Library tool.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/individual/email-template-library/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Local UI Surface

This folder now includes a self-contained template browser and preview workflow:

- `components/EmailTemplateLibrary.tsx` renders the folder-local UI.
- `fixtures/templates.ts` provides deterministic sample templates.
- `docs/review-guide.md` documents loading, error, empty, and success states plus accessibility behavior.
- `index.ts` exports the component and fixtures for a future integration issue.

The UI is not mounted in the main application. Reviewers can inspect or import it locally without changing app routing, navigation, authentication, wallet flows, Stellar integration, database schema, or the shared design system.

See `specs.md` for the issue categories and contributor expectations.
