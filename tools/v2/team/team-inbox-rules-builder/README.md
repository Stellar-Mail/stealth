# Team Inbox Rules Builder

A self-contained team tool for visually building and managing automated inbox rules.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/team-inbox-rules-builder/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Folder Structure

```
team-inbox-rules-builder/
├── types/              # TypeScript definitions
│   ├── rules.ts        # Rule, condition, action types
│   └── index.ts
├── services/           # Business logic
│   ├── rule-engine.service.ts   # Rule evaluation and execution
│   ├── rule-storage.service.ts  # In-memory rule storage
│   └── index.ts
├── hooks/              # React state management
│   ├── use-rules.ts             # Rule CRUD operations
│   ├── use-rule-evaluation.ts   # Rule evaluation hook
│   └── index.ts
├── components/         # UI components
│   ├── rule-list.tsx            # Browse and manage rules
│   ├── rule-builder.tsx         # Create/edit rules
│   ├── rule-preview.tsx         # Preview rule behavior
│   ├── empty-state.tsx          # No rules state
│   ├── loading-state.tsx        # Loading state
│   ├── error-state.tsx          # Error state
│   ├── success-state.tsx        # Success confirmation
│   └── index.ts
├── fixtures/           # Mock data
│   └── rules.fixtures.ts
├── tests/              # Test workspaces
│   └── test-plan.md
├── docs/               # Documentation
│   ├── ARCHITECTURE.md          # Architecture guide
│   ├── ACCESSIBILITY.md         # Accessibility guide
│   └── VISUAL_STYLE.md          # Visual design guide
├── specs.md            # Issue categories and contributor notes
└── README.md           # This file
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the complete architecture plan.
