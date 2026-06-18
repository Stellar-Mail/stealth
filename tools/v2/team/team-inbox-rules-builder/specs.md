# Team Inbox Rules Builder - Specifications

## Purpose

Provide team members with a visual builder for defining and managing automated inbox rules. This is a **standalone V2 tool** with no dependencies on the main app.

## Scope

- **Release Tier**: V2 (Later Release Tool)
- **Audience**: Team
- **Folder Ownership**: `tools/v2/team/team-inbox-rules-builder/`
- **Status**: Architecture and folder contract

## Tool Description

Visual automation rules builder that allows team members to create, edit, organize, and manage conditional rules for inbound mail routing. Rules define actions (file, forward, flag, notify, auto-reply) triggered by conditions (sender, subject keywords, priority, attachments, etc.).

## Module Boundaries

```
types/          Data types, rule definitions, conditions, actions
services/       Rule engine logic, storage, validation
hooks/          React state management for rule CRUD and evaluation
components/     UI components for rule list, builder, preview
fixtures/       Mock rule data for testing and demo
tests/          Unit, integration, and accessibility tests
docs/           Architecture, accessibility, and visual style guides
```

## Data Ownership

- Rules are owned locally by the tool via in-memory storage
- No database, API, or Stellar integration
- Export/import via JSON files for portability

## Dependencies

- React (existing project dependency)
- TypeScript (existing)
- No new external dependencies

## Integration Constraints

- ❌ No main app routing, navigation, or dashboard
- ❌ No wallet core or Stellar integration
- ❌ No inbox architecture or mail rendering
- ❌ No authentication or authorization
- ❌ No database schema or API endpoints

## Issue Categories

### Architecture

- Folder structure and organization
- Service design and data flow
- Hook patterns and state management
- Type definitions and contracts

### Feature

- Rule CRUD (create, read, update, delete)
- Rule conditions builder
- Rule actions configuration
- Rule evaluation/preview engine

### UI and Accessibility

- Component implementation
- Keyboard navigation
- Screen reader support
- Visual design and dark mode
- Responsive layout

### Security and Performance

- Input validation
- Rule validation (circular, conflicting)
- Performance optimization for large rule sets

### Testing and Documentation

- Unit tests
- Integration tests
- Test fixtures
- Documentation updates

## Acceptance Criteria

- [ ] Clear folder-local architecture plan documented
- [ ] Module boundaries defined for all internal layers
- [ ] Data ownership and dependencies documented
- [ ] Integration constraints explicitly stated
- [ ] No modifications to main app shell, routing, or core systems
- [ ] Files changed limited to `tools/v2/team/team-inbox-rules-builder/`

## Files Changed Scope

Only files within `tools/v2/team/team-inbox-rules-builder/` may be modified:

✅ Do modify:

- `types/`
- `services/`
- `hooks/`
- `components/`
- `fixtures/`
- `tests/`
- `docs/`
- README.md
- specs.md

❌ Do NOT modify:

- `src/` (main app code)
- `src/features/design-system/`
- `src/routes/`
- `src/server/`
- Package.json
- tsconfig.json
- vite.config.ts

## Next Steps

### Phase 1: Architecture ✅ (This Issue)

- Folder structure, module boundaries, architecture docs
- Type definitions and service contracts
- No UI or runtime code

### Phase 2: Core Engine (Future)

- Rule service implementation (CRUD, evaluation)
- Conditions and actions logic
- In-memory storage with JSON export

### Phase 3: UI Components (Future)

- Rule list, builder form, preview panel
- Empty, loading, error, success states
- Keyboard and screen reader support

### Phase 4: Testing & Integration (Future)

- Unit and integration tests
- E2E tests with Playwright
- Main app integration (separate issue)
