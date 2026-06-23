# Internal Comment Thread Usage Notes

## Local Setup

No app-wide setup is required for this isolated documentation and fixture slice. Reviewers can run
the folder-local documentation test from the repository root:

```bash
node tools/v1/team/internal-comment-thread/tests/documentation-contract.test.mjs
```

Future service or UI work may add local package scripts, but those scripts must stay inside this
tool folder.

## Review Fixture

The fixture at `fixtures/sample-internal-comment-thread.json` models synthetic internal comments:

- one message-level target with two internal comments
- one thread-level target with one internal comment
- an external-facing payload sample that includes counts and timestamps only
- all addresses use `.test` domains
- no production mail, credentials, secrets, payment data, or local user data is included

## Expected Workflow

1. Load a message or thread target selected from a future shared inbox adapter.
2. Validate that the current author belongs to the team roster.
3. Add or list internal comments for that exact target.
4. Build external-facing reply or summary data without comment body text.
5. Review generated payloads to ensure internal notes remain team-only.

## Review Checklist

- All changed files stay under `tools/v1/team/internal-comment-thread/`.
- Tests or test plans are folder-local.
- Fixtures are deterministic and synthetic.
- Known limitations are documented before integration.
- The no-leak visibility rule is called out in tests and docs.
- No main app shell, routing, wallet, Stellar core, database, or shared design system files change.
