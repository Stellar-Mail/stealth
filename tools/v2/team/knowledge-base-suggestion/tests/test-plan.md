# Test Plan

Future implementation issues should add folder-local tests for:

- Relevant article snapshots producing deterministic ranked suggestions
- Missing or malformed inputs returning typed errors
- Visibility, locale, product, and team metadata filtering
- Stable tie-breaking when candidates receive equal scores
- Match reasons corresponding to the factors used by ranking
- Empty candidate sets producing a typed no-suggestion result
- Services operating without network, database, inbox, wallet, or Stellar access
- Hooks exposing loading, success, empty, and error states
- Components rendering suggestions without inserting or mutating mail content
- Fixtures containing no secrets, private articles, or real personal mail data

Tests must use local fixtures and mocks. Live mailboxes, knowledge-base providers,
search indexes, wallets, Stellar networks, and application databases are outside
this tool's test boundary.
