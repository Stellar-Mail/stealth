# Testing

The Email Template Library ships with framework-free unit tests. They run on
Node's built-in test runner using native TypeScript type stripping, so no
bundler, transpile step, database, or network access is required.

## Running the tests

From the repository root, run either test file:

    node --experimental-strip-types --test tools/v2/individual/email-template-library/tests/service.test.ts
    node --experimental-strip-types --test tools/v2/individual/email-template-library/tests/execution-contract.test.ts

Or run every test in the folder at once:

    node --experimental-strip-types --test tools/v2/individual/email-template-library/tests/

## Coverage

`service.test.ts` drives the JSON fixtures under `fixtures/` (a successful
render, missing render variables, and an unknown template) and confirms that
`list` results are cloned so a caller cannot mutate the source catalog.

`execution-contract.test.ts` covers the remaining branches of the contract:

| Area     | Case                             | Expected result          |
| :------- | :------------------------------- | :----------------------- |
| list     | no filter                        | every template returned  |
| list     | matching categoryId              | only that category       |
| list     | unknown categoryId               | empty list               |
| get      | known id                         | one template             |
| render   | declared values supplied         | placeholders substituted |
| render   | unknown placeholder              | left untouched           |
| get      | unknown id                       | TEMPLATE_NOT_FOUND       |
| render   | omitted variable                 | MISSING_VARIABLES        |
| render   | non-string values                | INVALID_REQUEST          |
| envelope | foreign tool                     | INVALID_REQUEST          |
| envelope | unknown operation                | INVALID_REQUEST          |
| envelope | version other than 1             | UNSUPPORTED_VERSION      |
| catalog  | invalid template entry           | INVALID_TEMPLATE         |
| factory  | invalid catalog                  | constructor throws       |
| factory  | source mutated post-construction | snapshot unaffected      |

## Notes

All templates used in the tests are fake and deterministic, so the suite is
repeatable and side-effect free.
