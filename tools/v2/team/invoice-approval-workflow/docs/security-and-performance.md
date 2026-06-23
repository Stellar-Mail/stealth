# Security and Performance - Invoice Approval Workflow

## Threat Assumptions

- Invoice submissions may come from a future UI, webhook, or imported email
  attachment and must be treated as untrusted until validated.
- Vendor names, invoice numbers, memos, filenames, and approver emails can carry
  hostile input.
- This tool is isolated and does not yet connect to the main app, payment rails,
  persistence, authentication, or mail rendering.

## Unsafe Input Handling

| Input | Risk | Guard |
| --- | --- | --- |
| `invoiceId` | path traversal or lookup abuse | allow only letters, numbers, `_`, and `-` |
| `invoiceNumber` | control characters or markup-like values | strip controls, enforce safe characters |
| `vendorName` | markup injection | strip controls and reject `<` or `>` |
| `approverEmail` | CRLF header injection | reject `\r`, `\n`, and null bytes |
| `amount` | negative, infinite, or huge values | require finite positive values under approval cap |
| attachments | path traversal, unsafe MIME, large files | safe filename, allowlist MIME, max size |
| free-text memo | control characters and render cost | strip controls and cap length |

Renderers must still HTML-escape sanitized text before display.

## Performance Limits

| Data set | Limit | Rationale |
| --- | ---: | --- |
| line items | 200 | prevents large synchronous validation loops |
| attachments | 25 | prevents eager preview or scan overload |
| attachment size | 25 MB | keeps local review bounded |
| approval history | 500 | requires pagination for long audit trails |
| team members | 100 | avoids unbounded reviewer search |
| memo length | 2,000 chars | keeps render and review cost small |

Future integrations should paginate server-side and call these guards per page.

## Review Commands

Run from the repository root:

```bash
node tools/v2/team/invoice-approval-workflow/tests/invoice-guards.test.mjs
```

The test suite uses only local fixtures and synthetic `.test` emails. It does not
load real invoice PDFs, bank details, customer data, or live network resources.
