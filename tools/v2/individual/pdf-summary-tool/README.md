# PDF Summary Tool - README

## Quick Start

Welcome to the **PDF Summary Tool** — a self-contained, isolated workspace for building PDF summarization capabilities.

### What is This?

This is a **mini-product**: a complete, self-contained tool built within a single folder that operates independently of the main application. It does not modify, import from, or depend on the main app's shell, routing, mail engine, wallet, or database.

**Release Tier:** V2 Later  
**Audience:** Individual Users  
**Folder Ownership:** `tools/v2/individual/pdf-summary-tool/`

---

## Ownership Boundary (Hard Line)

```
✓ Everything in:  tools/v2/individual/pdf-summary-tool/
✗ Nothing else should touch main app core
```

All code, tests, fixtures, components, services, and documentation **must stay inside this folder**. This tool will not be wired into the main application until a separate integration issue is created.

---

## Architecture

### Folder Structure

```
pdf-summary-tool/
├── components/              # React UI components
├── services/                # Business logic & data processing
├── hooks/                   # React custom hooks
├── types/                   # TypeScript definitions
├── utils/                   # Pure utility functions
├── fixtures/                # Test data
├── tests/                   # Unit and integration tests
├── docs/                    # Local documentation
└── config/                  # Tool-specific configuration
```

**👉 See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete architecture specification.**

### Module Boundaries

| Module         | Responsibility   | Can Import From               | Cannot Import From                  |
| -------------- | ---------------- | ----------------------------- | ----------------------------------- |
| **Components** | React UI         | Hooks, Types, Utils, Radix UI | Services (only via hooks), Main app |
| **Services**   | Business logic   | Types, Utils                  | Components, Main app                |
| **Hooks**      | State management | Services, Types               | Main app                            |
| **Types**      | Type definitions | Nothing                       | Main app                            |
| **Utils**      | Pure functions   | Nothing                       | Main app                            |
| **Tests**      | Test cases       | Any module                    | Main app                            |

---

## What You Can Do

✅ **You CAN modify:**

- Components within `components/`
- Services within `services/`
- Hooks within `hooks/`
- Types, utilities, tests, fixtures, docs
- Configuration within `config/`
- Any file or folder inside this tool's directory

## What You Cannot Do

❌ **You CANNOT:**

- Import from or depend on `src/` (main app)
- Modify `src/routes/`, `src/router.tsx`, or `src/server/`
- Use main app's mail rendering engine
- Use main app's wallet/Stellar core
- Modify main app's authentication system
- Change main app's dashboard or navigation
- Modify main app's database schema
- Wire this tool into main app routing (that's a future issue)

**See [INTEGRATION_CONSTRAINTS.md](./INTEGRATION_CONSTRAINTS.md) for complete constraints.**

---

## Specifications

See [specs.md](./specs.md) for product specifications and requirements.

---

## Contributing

### For Developers

1. **Understand the architecture:** Read [ARCHITECTURE.md](./ARCHITECTURE.md)
2. **Know the boundaries:** Read [INTEGRATION_CONSTRAINTS.md](./INTEGRATION_CONSTRAINTS.md)
3. **Understand data flow:** Read [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md)
4. **Follow patterns:** Read [CONTRIBUTOR_GUIDE.md](./CONTRIBUTOR_GUIDE.md)

### Development Commands

```bash
# Run tests for this tool
npm test tests/unit

# Run E2E tests
npm run test:e2e -- tests/e2e/pdf-summary-tool

# Watch mode
npm test:watch
```

### File Locations

- 📄 **Component tests:** `tests/unit/components/`
- 🔧 **Service tests:** `tests/unit/services/`
- 🪝 **Hook tests:** `tests/unit/hooks/`
- 📋 **Integration tests:** `tests/integration/`
- 📚 **Fixtures:** `fixtures/`

---

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Complete architecture specification
- [MODULE_BOUNDARIES.md](./MODULE_BOUNDARIES.md) - Detailed module contracts
- [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md) - Data flow and ownership
- [INTEGRATION_CONSTRAINTS.md](./INTEGRATION_CONSTRAINTS.md) - Hard boundaries
- [CONTRIBUTOR_GUIDE.md](./CONTRIBUTOR_GUIDE.md) - How to extend this tool
- [docs/API.md](./docs/API.md) - Internal API reference
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) - Local dev setup
- [docs/FUTURE_INTEGRATION.md](./docs/FUTURE_INTEGRATION.md) - Integration roadmap

---

## Decision Record

**Q: Why is this isolated from the main app?**

A: This tool is in V2 Later, meaning it's not yet integrated into the main application. By building it in isolation with clear boundaries, we can:

1. ✅ Keep contributions small and reviewable
2. ✅ Avoid breaking main app functionality
3. ✅ Make it easy to integrate later (via a separate issue)
4. ✅ Let contributors focus on tool logic without main app complexity

**Q: How do I integrate this with the main app later?**

A: That will be a separate, follow-up issue. See [docs/FUTURE_INTEGRATION.md](./docs/FUTURE_INTEGRATION.md).

**Q: Can I use main app components/services?**

A: No. This tool must be completely self-contained. If you need similar functionality, implement it locally within this tool.

---

## Questions?

Check the documentation files listed above. If you're uncertain about a boundary or constraint, ask in a PR comment or issue.

**Remember:** Keep it local. Keep it simple. Keep it reviewable. 🎯
