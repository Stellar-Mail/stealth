# Email Ownership Tracker Usage Notes

## Local Setup

No app-wide setup is required for this isolated documentation and fixture slice. Reviewers can read
the tool docs and run the folder-local Node test directly from the repository root:

```bash
node tools/v1/team/email-ownership-tracker/tests/documentation-contract.test.mjs
```

Future service or UI work may add local package scripts, but it must stay inside this tool folder.

## Review Fixture

The fixture at `fixtures/sample-ownership-history.json` models a synthetic shared inbox history:

- one message is claimed and reassigned
- one message is claimed and escalated
- one message is claimed and released
- all addresses use `.test` domains
- no production mail, credentials, secrets, payment data, or local user data is included

## Expected Workflow

1. Load sanitized ownership events from a future integration adapter or local fixture.
2. Validate event IDs, message IDs, actors, owners, timestamps, and actions.
3. Build a chronological ownership history per message.
4. Derive the current owner and handoff count for each message.
5. Render or review the derived state without mutating source mail records.

## Review Checklist

- All changed files stay under `tools/v1/team/email-ownership-tracker/`.
- Tests or test plans are folder-local.
- Fixtures are deterministic and synthetic.
- Known limitations are documented before integration.
- No main app shell, routing, wallet, Stellar core, database, or shared design system files change.
