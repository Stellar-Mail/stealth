# Test Plan

Future implementation issues should add folder-local tests for:

- Valid mail snapshots producing deterministic ticket drafts
- Missing or malformed required fields returning typed errors
- Mapping rules for priority, labels, assignees, and destination projects
- HTML or unsafe content being normalized before draft construction
- Attachment metadata remaining references rather than copied content
- Services operating without network, database, inbox, wallet, or Stellar access
- Hooks exposing loading, success, warning, and error states
- Components rendering empty, review, and failure states from local contracts
- Fixtures containing no secrets or real personal mail data

Tests must use local fixtures and mocks. Live mailboxes, ticket systems, wallets,
Stellar networks, and application databases are outside this tool's test boundary.
