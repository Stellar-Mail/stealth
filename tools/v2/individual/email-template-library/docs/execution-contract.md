# Non-UI execution contract

The folder root exports a presentation-independent TypeScript API. It performs no network, persistence, React, or DOM work.

## Entry points

- `executeEmailTemplateLibrary(request, templates)` executes one request against a caller-owned, read-only catalog.
- `createEmailTemplateLibraryService(templates)` snapshots a validated catalog and returns an object with `execute(request)`.

Requests always include `tool: "email-template-library"`, `version: 1`, and an operation:

- `list` optionally filters by `categoryId`.
- `get` returns one template by `templateId`.
- `render` substitutes declared `{{variable}}` placeholders using a string `values` map.

Responses are discriminated by `status`. Success responses contain a typed `result`; failures contain a stable `error.code`, human-readable `message`, and optional machine-readable `details`.

## Error codes

- `INVALID_REQUEST`: envelope, operation, identifier, filter, or values are malformed.
- `UNSUPPORTED_VERSION`: the caller requests a contract version other than `1`.
- `INVALID_TEMPLATE`: a catalog entry violates the documented template shape.
- `TEMPLATE_NOT_FOUND`: no catalog entry matches `templateId`.
- `MISSING_VARIABLES`: rendering omitted one or more declared variables.

The complete input, output, service, entity, and error types are exported from `types/index.ts`. JSON fixtures under `fixtures/` cover a successful render, missing render variables, and an unknown template.
