# Email Template Library

This folder is the isolated workspace for the Email Template Library tool.

## Ownership Boundary

All work for this tool must stay inside:

`text
.\tools\v2\individual\email-template-library\
`

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

See specs.md for the issue categories and contributor expectations.

## Non-UI execution

The folder root exports a versioned backend-facing service contract with no UI dependencies. See `docs/execution-contract.md` for request, response, error-code, and fixture details.

Run its focused tests with:

```sh
node --experimental-strip-types --test tools/v2/individual/email-template-library/tests/service.test.ts
```
