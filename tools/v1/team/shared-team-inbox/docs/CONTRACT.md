# Shared Team Inbox - Contract & Guidelines

## Contributor Specs

This document defines what future contributors may and may not change when working on the Shared Team Inbox tool.

### What Contributors MAY Change

1. **Folder-Local Implementation**: You may add, modify, or delete files exclusively within `tools/v1/team/shared-team-inbox/`.
2. **Local UI Components**: You may build self-contained UI components inside `components/`.
3. **Local Logic**: You may implement data fetching, transformations, and caching mechanisms within `services/` and `hooks/`.
4. **Mock Fixtures**: You may add deterministic fixtures and dummy data for testing and UI development.
5. **Testing**: You may expand unit and integration tests inside `tests/` as long as they do not require a live network or external environment.

### What Contributors MAY NOT Change

1. **Core Application Shell**: Do not modify the main dashboard layout, navigation system, or global app shell.
2. **Existing Inbox Architecture**: Do not touch the existing mail rendering engine or current inbox structures. The Shared Team Inbox must be entirely distinct at this phase.
3. **Authentication & Wallet Core**: Do not integrate with or modify the wallet core or Stellar integration core. Rely entirely on mocked authentication and mocked wallet interactions.
4. **Database Schema**: Do not introduce Prisma or database schema migrations for this tool. Assume the API contract is predefined or mocked.
5. **Design System**: Do not override or modify global CSS/design tokens.

## Compliance

Any Pull Request touching the Shared Team Inbox must be reviewable as a completely isolated feature. If integration with the main mail app is required, it must be scoped as a separate follow-up issue with specific integration labels.
