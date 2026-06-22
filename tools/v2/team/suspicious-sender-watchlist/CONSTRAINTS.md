# Suspicious Sender Watchlist — Contributor Constraints

This document specifies what contributors **can** and **cannot** change when working on this tool.

## What Contributors CAN Change

### ✅ Within `tools/v2/team/suspicious-sender-watchlist/`

1. **Create/Modify Components**
   - Add new UI components in `components/`
   - Modify existing components within this tool
   - Add component-level state management

2. **Create/Modify Services**
   - Add business logic in `services/`
   - Modify watchlist operations (add, update, dismiss, remove)
   - Implement filtering and search logic
   - Add dependency injection for testability

3. **Create/Modify Hooks**
   - Add React hooks for state management
   - Compose services into reusable hooks
   - Implement custom hooks for features
   - Export stable, memoized values

4. **Create/Modify Types**
   - Define watchlist entry data shapes
   - Define filter and input types
   - Define metrics interfaces
   - Create TypeScript types and interfaces

5. **Expand Tests**
   - Add unit tests for services
   - Add tests for hooks (when implemented with real React)
   - Add component tests
   - Add integration tests
   - Create test fixtures

6. **Expand Fixtures**
   - Add mock watchlist entries
   - Create builder utilities for tests
   - Add sample state configurations covering edge cases

7. **Document**
   - Update README.md with new features
   - Update docs/ with decisions, test plans, and review notes
   - Document new service interfaces
   - Update this constraints file as architecture evolves

8. **Update Index**
   - Re-export new types, services, hooks, components through `index.ts`

## What Contributors CANNOT Change

### ❌ Outside `tools/v2/team/suspicious-sender-watchlist/`

**The following files/directories are OFF-LIMITS:**

1. **Main Application Shell**
   - `src/router.tsx`
   - `src/routes/__root.tsx`
   - App-level layout and navigation

2. **Routing System**
   - Main route definitions in `src/routes/`
   - Route tree generation
   - Navigation orchestration (except future integration issue)

3. **Mail/Inbox Architecture**
   - `src/features/mail/` (DO NOT MODIFY)
   - Mail rendering engine
   - Existing inbox state
   - Mail service implementations

4. **Authentication System**
   - `src/services/` auth modules
   - Session management
   - User context (await integration issue)

5. **Wallet & Stellar Core**
   - `src/services/stellar/`
   - `src/services/crypto/`
   - Wallet operations
   - Blockchain integration

6. **Database Schema**
   - Any database migrations
   - Schema definitions in `contracts/`
   - Existing data models

7. **Design System** (Core UI Components)
   - `src/components/ui/` core components
   - Design tokens
   - Shared component patterns

8. **Configuration Files** (Root Level)
   - `package.json` (core scripts only)
   - `tsconfig.json`
   - `vite.config.ts`
   - `eslint.config.js`
   - `wrangler.jsonc`

9. **Other Tool Directories**
   - `tools/v1/`
   - `tools/v2/[other-tools]/`
   - Scripts in `scripts/`

### ❌ Architectural Violations

Contributors **MUST NOT**:

1. **Create circular dependencies**
   - Services must not import from components
   - Components must not import services directly
   - Hooks can import from services, but not vice versa

2. **Break module boundaries**
   - Types layer: No service/hook/component imports
   - Service layer: No component imports
   - Component layer: No service imports (use hooks)

3. **Couple to main app internals**
   - Don't import main app service internals
   - Don't access main app state directly
   - Don't modify main app routes/components
   - Document any necessary main-app interfaces

4. **Add external dependencies**
   - Coordinate with team for new npm packages
   - Prefer existing dependencies
   - Document dependency rationale

5. **Create implicit integrations**
   - All main-app connections must be explicit
   - Document integration requirements
   - No side effects that leak into main app
   - No global state pollution

## Integration Requirements (When Applicable)

When the tool eventually integrates with the main app (in a follow-up issue):

### Required for Integration:

- Public service interfaces are well-documented
- No circular dependencies introduced
- Hooks cleanly expose composed state
- Types are exported from `types.ts`

### Not Allowed During Integration:

- Modifying main app routing for this tool
- Adding watchlist to main inbox feature
- Changing main authentication flow
- Modifying wallet core operations

## Code Review Checklist

When reviewing contributions to this tool, verify:

- ✅ All changes are within `tools/v2/team/suspicious-sender-watchlist/`
- ✅ No imports from files outside this directory
- ✅ Module boundaries are respected (dependency graph is one-way)
- ✅ Types are the only layer with zero dependencies
- ✅ Services don't import components
- ✅ Components don't import services directly
- ✅ New hooks compose existing services correctly
- ✅ Tests use local fixtures
- ✅ Documentation is updated
- ✅ No modifications to main app files

## Reporting Violations

If you find a constraint violation:

1. Document it in a comment
2. Don't approve the change
3. Request that the contributor move the work to a follow-up issue
4. Reference this CONSTRAINTS.md file

## Asking for Exceptions

If you believe a constraint should be changed:

1. Open an issue with `[suspicious-sender-watchlist-constraint]` in the title
2. Explain why the constraint is blocking progress
3. Propose an alternative architecture
4. Get team consensus before violating constraints

## Timeline

- **Current Issue (#673)**: Isolated testing and documentation only
- **Follow-up Issues**: Integration with main app (separate, reviewable work)

This ensures the tool is self-contained, reviewable, and maintainable.
