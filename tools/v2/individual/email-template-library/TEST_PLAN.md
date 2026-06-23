# Email Template Library Test Plan

This plan covers the isolated Email Template Library tool in `tools/v2/individual/email-template-library/`. It does not require wiring the tool into the main mail app.

## Scope

Use the synthetic fixtures in `fixtures/template-library-fixtures.json` to validate the expected behavior for template browsing, searching, rendering, and variable handling. Do not use live email, wallet, Stellar, authentication, or production user data.

## Fixture Coverage

The fixture file includes:

- three templates across work, recruiting, and billing categories;
- variable placeholders such as `{{firstName}}`, `{{companyName}}`, and `{{invoiceNumber}}`;
- preview values for a complete render path;
- intentionally missing preview values for negative-state checks.

## Manual Review Checks

1. Confirm all files changed by this issue stay under `tools/v2/individual/email-template-library/`.
2. Confirm the fixture data is synthetic and contains no real addresses, private keys, payment data, or production identifiers.
3. Confirm a template list can be reviewed by category, name, subject, and body text from the fixture data.
4. Confirm rendering replaces all variables when complete preview values are supplied.
5. Confirm missing variables are reported by key when a preview value is absent.
6. Confirm duplicate template names, blank subjects, and blank bodies are treated as validation errors in future implementation work.
7. Confirm empty search results and no-template states have explicit reviewer expectations.

## Suggested Future Automated Tests

When the service layer exists, add folder-local tests for:

- `searchTemplates(query)` returning templates by name, category, subject, or body text;
- `renderTemplate(id, values)` replacing known variables and returning missing variable keys;
- `validateTemplate(template)` rejecting empty names, duplicate names, empty subjects, and empty bodies;
- category filtering preserving stable ordering;
- fixture import remaining deterministic.

## Out-of-Scope Checks

Do not test the main app router, inbox, authentication, wallet state, Stellar calls, database persistence, or shared design system here. Those integrations need a separate issue.
