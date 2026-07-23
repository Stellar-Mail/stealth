# Draft Improver Specs

## Purpose

Draft Improver is an isolated V2 Individual Tool that analyzes email drafts before sending and provides actionable improvements for spelling, clarity, tone, structure, length, missing fields, and sensitive content.

## Release Information

- **Release Tier:** V2
- **Audience:** Individual

## Folder Ownership

All work for this tool must remain inside:

```text
tools/v2/individual/draft-improver/
```

This tool is intentionally isolated and must not be integrated into the main application unless a future integration issue explicitly allows it.

## Scope

### Included

- Local React components
- Local services
- Local fixtures
- Local tests
- Local documentation

### Excluded

The following are **out of scope** for this issue:

- Application routing
- Authentication
- Mail rendering engine
- Inbox architecture
- Wallet functionality
- Stellar integration
- Database schema
- Shared design system

## Review Checklist

Reviewers should verify that:

- All modified files remain inside the Draft Improver folder.
- Documentation is complete and accurate.
- Local tests execute successfully.
- Test fixtures contain only synthetic data.
- No integration with the main application has been introduced.

## Future Work

Future integration issues may add:

- Compose screen integration
- Draft persistence
- Mail workflow integration
- AI-assisted writing improvements

These items are intentionally excluded from this issue.
