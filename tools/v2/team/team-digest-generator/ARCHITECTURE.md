# Team Digest Generator - Architecture Contract

## Overview

The Team Digest Generator is a self-contained V2 tool that creates daily team summaries. This document defines the architecture contract, module boundaries, and integration constraints.

**Release Tier:** V2 (later-release)  
**Audience:** Team  
**Ownership:** `tools/v2/team/team-digest-generator/`

---

## Module Boundaries

### `components/`

- **Ownership:** UI components for the digest generator tool
- **Responsibilities:**
  - Render digest configuration UI
  - Display digest preview
  - Team member selection interface
  - Digest scheduling UI
- **Constraints:**
  - Do not import from main app routing, inbox architecture, or design system internals
  - Use only public design system exports
  - No direct database access
  - No authentication logic

### `services/`

- **Ownership:** Business logic and data processing
- **Responsibilities:**
  - Digest data aggregation
  - Email filtering and summarization
  - Team member resolution
  - Schedule management
  - Content sanitization and validation
- **Constraints:**
  - No direct component rendering
  - No wallet or Stellar core interactions (future integration only)
  - Must handle malformed input gracefully
  - Must optimize for large datasets

### `hooks/`

- **Ownership:** React hooks for state and side effects
- **Responsibilities:**
  - Local state management for digest configuration
  - Data fetching hooks
  - Validation hooks
- **Constraints:**
  - Do not wire to main app authentication
  - Use local-only state management
  - No global store modifications

### `tests/`

- **Ownership:** Unit and integration tests
- **Responsibilities:**
  - Service logic testing
  - Component rendering tests
  - Input validation and sanitization tests
  - Performance tests for large datasets
- **Constraints:**
  - Use local test fixtures only
  - No access to production database

### `docs/`

- **Ownership:** Architecture, API, and usage documentation
- **Responsibilities:**
  - API reference for services
  - Integration guidelines (for future issues)
  - Threat model and assumptions
  - Performance constraints
  - Data flow diagrams

---

## Data Ownership

### What This Tool Owns

- Digest configuration per team
- Digest generation schedule
- Email selection criteria for digests
- Generated digest content (temporary, not persisted)
- Digest preview state

### What This Tool Does NOT Own

- User authentication and authorization
- Mail rendering engine
- Inbox data storage
- Wallet or payment data
- Stellar blockchain interactions
- Global design system
- Main app routing

### Data Flow

```
Team Member Input → Service Validation → Digest Configuration
                ↓
            Email Query → Aggregation → Sanitization
                ↓
            Digest Preview → Component Rendering
```

---

## Integration Constraints

### ✅ **Permitted Internal Dependencies**

- Import from other parts of `tools/v2/team/team-digest-generator/`
- Use public design system components
- Use standard Stellar SDK types (if needed in types only)
- Use React and common utilities

### ❌ **Prohibited Dependencies**

- Main app routing (`src/router.tsx`, `src/routes/`)
- Inbox architecture (`src/features/inbox/`)
- Wallet core (`src/features/wallet/`)
- Stellar integration core (`src/services/stellar/`, `src/services/blockchain/`)
- Database schema modifications
- Main app authentication system
- Design system internals

### Future Integration (Out of Scope for This Issue)

- Wiring digest previews into main inbox
- Adding digest triggers to mail events
- Integration with user settings dashboard
- Wallet-based digest scheduling

_If future integration is needed, create a new issue instead of modifying this architecture._

---

## Contributor Guidelines

### What Contributors CAN Do

- ✅ Add new services for digest logic
- ✅ Create new components within this tool
- ✅ Add tests and documentation
- ✅ Optimize performance for large datasets
- ✅ Improve input validation and sanitization
- ✅ Add local fixtures and mock data

### What Contributors MUST NOT Do

- ❌ Modify main app shell or routing
- ❌ Modify inbox architecture
- ❌ Modify wallet core
- ❌ Modify Stellar blockchain integration
- ❌ Modify authentication system
- ❌ Modify database schema
- ❌ Modify main app design system
- ❌ Add dependencies on main app features outside this contract

### Folder Structure Rules

- All work must stay inside `tools/v2/team/team-digest-generator/`
- Do not create files outside this boundary
- Do not create new folders in `tools/v2/` without approval

---

## Development Workflow

### Adding a New Feature

1. Scope feature within this tool's boundaries
2. Add to appropriate module (components, services, or hooks)
3. Add tests in `tests/`
4. Document in `docs/`
5. Ensure no modifications outside the tool folder

### Testing

- Unit tests for all services
- Component rendering tests
- Input validation tests
- Performance benchmarks for large datasets (Issue 2)

### Code Review Checklist

- [ ] Changes only in `tools/v2/team/team-digest-generator/`
- [ ] No imports from prohibited dependencies
- [ ] New tests added
- [ ] Documentation updated
- [ ] Architecture contract respected

---

## Security Assumptions

See [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md) for complete threat model, mitigation strategies, and implementation details.

**Key constraints:**

- Input from team members must be validated (use `inputValidation` service)
- Email content must be sanitized before display (use `contentSanitization` service)
- No sensitive data should be logged (passwords, tokens, email bodies)
- Configuration should not leak to unauthorized users
- XSS, injection, and path traversal attacks must be prevented

**Implementation guide:**

- See [docs/API.md](./docs/API.md) for validation and sanitization API
- See [tests/security.example.test.ts](./tests/security.example.test.ts) for test patterns
- See [tests/fixtures.ts](./tests/fixtures.ts) for attack vectors and test data

---

## Performance Assumptions

See [docs/PERFORMANCE.md](./docs/PERFORMANCE.md) for complete performance model, optimization strategies, and benchmarks.

**Key constraints:**

- Digests should handle 1000+ emails per team per day
- Preview generation should complete in < 2 seconds
- Large dataset processing should stream, not batch load
- Memory footprint should scale linearly with email count
- No unnecessary data duplication
- Timeouts at 30 seconds per digest operation

**Optimization strategies:**

- Stream processing instead of batch loading
- Early exit when limits reached
- Efficient data structures (Set, Map, not Array)
- Caching for repeated operations (sanitization)
- Proper database indexing on timestamp and sender fields

---

## File Structure Reference

```
tools/v2/team/team-digest-generator/
├── ARCHITECTURE.md           (this file)
├── README.md                 (ownership boundary and overview)
├── specs.md                  (issue categories and scope)
├── components/               (UI components)
│   ├── DigestConfigForm.tsx
│   ├── DigestPreview.tsx
│   └── TeamMemberSelector.tsx
├── services/                 (business logic)
│   ├── digestAggregation.ts
│   ├── emailFiltering.ts
│   ├── teamResolution.ts
│   └── contentSanitization.ts
├── hooks/                    (React hooks)
│   ├── useDigestConfig.ts
│   └── useDigestPreview.ts
├── tests/                    (test suite)
│   ├── services/
│   ├── components/
│   └── fixtures/
├── docs/                     (documentation)
│   ├── API.md
│   ├── THREAT_MODEL.md
│   └── PERFORMANCE.md
└── types/                    (TypeScript types)
    └── index.ts
```

---

## Approval & Reviewability

This tool is reviewable as a self-contained mini-product. Code reviews should verify:

1. All changes are within the `tools/v2/team/team-digest-generator/` boundary
2. No modifications to protected app systems
3. Architecture contract is respected
4. Tests are comprehensive
5. Documentation is clear

---

## Next Steps

**Issue #685 (Architecture & contract):** This document.  
**Issue #687 (Security & performance hardening):** Add validation, sanitization, and performance optimization.  
**Future:** Integration with main app (separate issue).
