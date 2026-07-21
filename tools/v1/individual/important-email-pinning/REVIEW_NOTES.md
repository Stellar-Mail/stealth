# Important Email Pinning Review Notes

## Scope

This documentation pass is limited to:

```text
tools/v1/individual/important-email-pinning/
```

It does not wire the tool into the main app, inbox architecture, Gmail, routing,
database schema, wallet services, Stellar services, or shared design system.

## What Changed

- Added `MODULE_BOUNDARIES.md` to define component, service, hook, test, and docs ownership for the isolated mini-product.
- Added `DATA_OWNERSHIP.md` to document owned pin metadata, borrowed message summaries, derived data, persistence limits, and privacy rules.
- Added `INTEGRATION_CONSTRAINTS.md` to make disallowed host-app dependencies and future adapter requirements explicit.
- Updated `README.md` to point contributors to the folder-local architecture contract.
- Updated `specs.md` to list the architecture deliverables for issue review.

## Acceptance Coverage

- Architecture: folder boundary and non-integration constraints are explicit.
- Module boundaries: components, services, hooks, tests, and docs have defined responsibilities.
- Data ownership: pin metadata is owned locally, while mailbox records and message bodies remain outside this tool.
- Integration constraints: future contributors are told what they may and may not change before a separate integration issue.
- Testing and documentation: test plan and fixture catalog remain folder-local.

## Known Limitations

- Baseline pinning is local and advisory until a future integration issue defines persistence.
- Importance hints do not pin automatically.
- Future inbox integration must preserve explicit user action before mailbox mutation.
