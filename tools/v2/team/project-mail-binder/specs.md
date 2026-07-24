# Project Mail Binder

## Purpose

Group mail into project-specific collections within an isolated team workspace.

## Release

- Tier: V2
- Audience: Team

## Ownership Boundary

All work for this tool must remain inside:

```text
tools/v2/team/project-mail-binder/
```

Do not connect this tool to:

- application routing
- dashboard navigation
- authentication
- inbox architecture
- wallet functionality
- Stellar integration
- database schema
- shared design system

unless a future integration issue explicitly authorizes those changes.

## Recommended Structure

```text
components/
services/
hooks/
fixtures/
tests/
docs/
```

## Testing & Documentation Scope

This issue focuses exclusively on improving contributor documentation and validating the existing isolated implementation.

## Future Integration

Integration with the main application should be completed through a dedicated follow-up issue.
