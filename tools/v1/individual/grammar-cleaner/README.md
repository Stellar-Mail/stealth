# Grammar Cleaner

Correct grammar and writing issues in your text.

This folder is the isolated workspace for the Grammar Cleaner tool.
This folder is the isolated workspace for the Grammar Cleaner tool — a self-contained grammar correction module.

## Documentation

- [Setup Guide](docs/setup.md)
- [Usage Guide](docs/usage.md)
- [Test Fixtures](docs/fixtures.md)
- [Known Limitations](docs/limitations.md)

## Ownership Boundary

All work for this tool must stay inside:
`tools/v1/individual/grammar-cleaner/`

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Testing

Run local tests with:

```bash
./node_modules/.bin/vitest run -c tools/v1/individual/grammar-cleaner/vitest.config.ts
```

All work for this tool must stay inside `tools/v1/individual/grammar-cleaner/`.

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Quick Start

- `specs.md` — module boundaries, dependency rules, hard constraints
- `docs/architecture.md` — system design, data flow, design principles, extension strategy
- `tests/README.md` — test plan with unit scope, edge cases, manual checklist

## Folder Layout

```
components/       UI layer
services/         Pure transformation logic
hooks/            React state management
tests/            Test files and test plans
docs/             Developer documentation
```

See `specs.md` for the full module contract.
