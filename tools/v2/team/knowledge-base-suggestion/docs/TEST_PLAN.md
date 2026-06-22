# Knowledge Base Suggestion Test Plan

## Scope

This plan covers only the isolated team tool workspace:

```text
tools/v2/team/knowledge-base-suggestion/
```

The tool is not connected to the main app, inbox, wallet, Stellar code, database, live knowledge base, or external search index. Current validation focuses on local fixtures, documented review paths, and future test expectations.

## Setup

From the repository root, run:

```bash
node --test tools/v2/team/knowledge-base-suggestion/tests/fixture-contract.test.mjs
```

No app server, mailbox fixture, document provider, search index, API key, or database is required.

## Fixture Inventory

The synthetic review scenarios live in:

```text
tools/v2/team/knowledge-base-suggestion/fixtures/suggestion-scenarios.json
```

They cover:

- a missing incident runbook that can become a suggestion
- a stale onboarding article that needs reviewer confirmation
- a duplicate VPN setup suggestion
- secret-looking context that should be blocked
- a low-evidence feature request that should be rejected

The fixture contract test verifies stable ids, target article slugs, article sections, review signals, all planned outcomes, and broad section coverage.

## Future Service Tests

When local service modules are implemented, add tests under `tests/` that reuse the fixtures and verify:

- duplicate suggestions return `duplicate`
- secret-looking context returns `blocked`
- stale articles return `needs_review`
- low-evidence proposals return `rejected`
- high-quality missing-doc proposals return `suggested`
- no service publishes content or calls a live provider

## Future Hook Tests

When hooks are implemented, add hook tests that verify:

- initial suggestion queue state
- selected suggestion state
- outcome transitions across reviewer actions
- recoverable validation errors
- no persistence to main app stores

## Future Component Tests

When UI components are implemented, add component tests that verify:

- source context, target slug, section, and review signals are visible
- reviewer actions are keyboard operable
- blocked and rejected states require clear reasons
- duplicate suggestions show the existing article slug
- sensitive context warnings are announced without mounting the main app

## Known Limitations

- This plan does not validate a real knowledge base provider or search index.
- The current fixture contract test validates scenario structure, not production suggestion scoring.
- The tool has no approved integration with mailbox, docs, wallet, Stellar, or database modules.
- All source context is synthetic and should stay synthetic until a future integration issue defines data handling rules.

## Independent Review

Reviewers can validate this issue without running the full app:

1. Confirm all changed files stay under `tools/v2/team/knowledge-base-suggestion/`.
2. Run the fixture contract test command above.
3. Confirm the fixtures are synthetic and cover all planned outcomes.
4. Confirm this plan documents setup, usage, fixtures, future coverage, and limitations.
