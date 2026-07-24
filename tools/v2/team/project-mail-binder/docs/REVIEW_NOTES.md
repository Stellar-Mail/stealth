# Review Notes

## Purpose

This contribution improves the testing guidance and contributor documentation for the Project Mail Binder tool while keeping all work isolated to the tool workspace.

## Scope

All modified files are contained within:

```text
tools/v2/team/project-mail-binder/
```

No application routing, authentication, inbox workflow, database, wallet, or shared UI components were modified.

## How to Review

1. Read `README.md`.
2. Review `specs.md`.
3. Read `docs/TEST_PLAN.md`.
4. Run the local tests:

```bash
npx vitest run tools/v2/team/project-mail-binder/
```

5. Confirm all tests pass.
6. Verify every changed file is contained within the tool folder.
7. Confirm no application integration has been introduced.

## Expected Result

- Existing tests pass.
- Documentation accurately reflects the implementation.
- The tool remains completely isolated.
- Future integration work is documented but not implemented.

## Out of Scope

This issue intentionally excludes:

- routing
- mailbox integration
- authentication
- database changes
- wallet functionality
- Stellar integration
- shared UI components
