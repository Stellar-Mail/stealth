# Internal Comment Thread Test Plan

## Scope

This test plan covers the isolated Internal Comment Thread tool under:

```text
tools/v1/team/internal-comment-thread/
```

Tests must stay folder-local and must not require the main app shell, routing, wallet, Stellar core,
database, production inbox data, or shared design system integration.

## Core Behavior Coverage

When services are present, folder-local tests should cover:

- creating comments for authorized team members only
- rejecting empty, malformed, or oversized comment bodies
- listing comments by exact message or thread target
- preserving target isolation between message-level and thread-level comments
- allowing authors to update and delete their own comments
- rejecting update and delete attempts from other team members
- proving that external-safe summaries never include comment body text

## UI And Accessibility Coverage

When components are present, tests or manual review notes should cover:

- empty, loading, error, and success states
- labelled composer controls
- keyboard access for submit, edit, delete, cancel, and retry actions
- visible focus states on comment actions
- delete confirmation with clear accessible text
- no comment body rendered in external-sender previews

## Visibility Contract Coverage

Every change must preserve the firm rule:

```text
Internal comment body text must never be included in an external reply, forward, notification,
header, log, or payload.
```

Fixture and contract tests should include a phrase that appears in internal comments and assert that
the phrase does not appear in any external-facing payload sample.

## Contributor Validation Commands

```bash
node tools/v1/team/internal-comment-thread/tests/documentation-contract.test.mjs
git diff --check
git diff --name-only
```

Add exact service or UI test commands here when those layers are introduced.
