# Review Notes

## Purpose

This contribution improves the testing and documentation for the Draft Improver tool while keeping all changes isolated to the tool workspace.

## Scope

All modified files are contained within:

```text
tools/v2/individual/draft-improver/
```

No application routing, authentication, inbox workflow, database, wallet, or shared UI components were modified.

## How to Review

1. Read `README.md` for an overview of the tool.
2. Review `specs.md` to understand the scope and ownership boundaries.
3. Read `docs/TEST_PLAN.md`.
4. Run the local fixture test:

```bash
node --test tools/v2/individual/draft-improver/tests/draft-fixtures.test.mjs
```

5. Confirm all tests pass.
6. Verify all sample drafts are synthetic (`containsPersonalData: false`).
7. Ensure no files outside `tools/v2/individual/draft-improver/` were modified.

## Expected Result

- Documentation is complete and easy to follow.
- Local tests pass successfully.
- The tool remains fully isolated and ready for future integration.

## Out of Scope

The following are intentionally excluded from this issue:

- Application routing
- Compose UI integration
- Mailbox integration
- Database changes
- Authentication
- Shared design system
- External APIs
