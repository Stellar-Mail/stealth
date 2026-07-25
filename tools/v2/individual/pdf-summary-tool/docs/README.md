# Docs

Documentation for the PDF Summary Tool.

## Files

- `README.md` - This file
- `API.md` - Internal API reference for all services, hooks, utilities
- `DEVELOPMENT.md` - Local development setup and workflows
- `FUTURE_INTEGRATION.md` - How to integrate with main app (future)

## Quick Links

**For Contributors:**

- Getting started? → [DEVELOPMENT.md](./DEVELOPMENT.md)
- Need API docs? → [API.md](./API.md)
- How to implement? → [../CONTRIBUTOR_GUIDE.md](../CONTRIBUTOR_GUIDE.md)
- What are constraints? → [../INTEGRATION_CONSTRAINTS.md](../INTEGRATION_CONSTRAINTS.md)

**For Architects:**

- Full architecture? → [../ARCHITECTURE.md](../ARCHITECTURE.md)
- Module contracts? → [../MODULE_BOUNDARIES.md](../MODULE_BOUNDARIES.md)
- Data ownership? → [../DATA_OWNERSHIP.md](../DATA_OWNERSHIP.md)

**For Future Integration:**

- Integration plan? → [FUTURE_INTEGRATION.md](./FUTURE_INTEGRATION.md)

## How to Use These Docs

### Reading Documentation

1. Start with what you need:

   - **Development setup** → [DEVELOPMENT.md](./DEVELOPMENT.md)
   - **API reference** → [API.md](./API.md)
   - **Contributing** → [../CONTRIBUTOR_GUIDE.md](../CONTRIBUTOR_GUIDE.md)
   - **Architecture** → [../ARCHITECTURE.md](../ARCHITECTURE.md)

2. Follow the links for deeper context

3. Check code examples and patterns

### Contributing to Documentation

When updating docs:

- Use clear, concise language
- Include code examples
- Add links between related docs
- Keep docs up-to-date with code changes
- Document new APIs immediately

## Guidelines

- ✅ Keep docs in sync with code
- ✅ Include practical examples
- ✅ Link between related topics
- ✅ Document constraints clearly
- ✅ Explain the "why" not just "what"

- ❌ Don't document main app in this folder
- ❌ Don't include copy-paste from main app docs
- ❌ Don't leave docs stale

## Updating Documentation

When adding features:

1. **Update types** → `docs/API.md` - Add new types/interfaces
2. **Update services** → `docs/API.md` - Document new service functions
3. **Update hooks** → `docs/API.md` - Document new hook APIs
4. **Update utilities** → `docs/API.md` - Document new utility functions
5. **Update development** → `DEVELOPMENT.md` - Add setup/workflow notes if needed
6. **Update architecture** → `../ARCHITECTURE.md` - Only if module boundaries change

## Related Documentation

Outside this folder:

- `../README.md` - Quick start
- `../ARCHITECTURE.md` - Full architecture specification
- `../MODULE_BOUNDARIES.md` - Detailed module contracts
- `../DATA_OWNERSHIP.md` - Data flow and ownership
- `../INTEGRATION_CONSTRAINTS.md` - Hard boundaries
- `../CONTRIBUTOR_GUIDE.md` - How to contribute

## Questions?

1. Check if there's a relevant docs file
2. Search for similar examples in code
3. Ask in PR comments or issues
