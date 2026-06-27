# Team Digest Generator

Self-contained V2 tool for generating daily team email summaries.

## Ownership boundary

All work for this tool must stay inside:

```
tools/v2/team/team-digest-generator/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Module boundaries, data ownership, integration constraints, and contributor guidelines
- **[specs.md](./specs.md)** - Issue categories and scope
- **[docs/](./docs/)** - API reference, threat model, performance notes

## Recommended Internal Structure

```
team-digest-generator/
├── components/          # UI components for digest tool
├── services/           # Business logic and data processing
├── hooks/              # React hooks for state management
├── tests/              # Unit and integration tests
├── docs/               # Architecture, API, threat models
└── types/              # TypeScript type definitions
```

## Key Constraints

- ✅ Add components, services, hooks, tests, and docs within this folder
- ❌ Do not modify main app shell, routing, inbox, wallet core, or Stellar integration
- ❌ Do not add wiring to main app features
- ❌ Do not modify design system or authentication

## Getting Started

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) for module boundaries
2. Add your feature to the appropriate module (components/, services/, hooks/)
3. Add tests in tests/
4. Update docs/ with API or design notes
5. Keep all changes within this folder boundary

## Future Integration

This tool is designed as an isolated mini-product. If a future issue requires integration with the main app (dashboard, inbox, settings), that work should be in a separate issue with explicit approval to modify protected areas.
