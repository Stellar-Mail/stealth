# Vendor Mail Tracker - Architecture Contract

## Executive Summary

The Vendor Mail Tracker is designed as an isolated, self-contained mini-product. It maintains complete separation from the main application shell while establishing clear, documented integration boundaries for future main-app connectivity.

## Design Principles

1. **Self-Containment**: All tool logic lives within `tools/v2/team/vendor-mail-tracker/`
2. **Dependency Transparency**: External dependencies are explicitly documented
3. **Testability**: Components are independently testable without main app context
4. **Scalability**: Architecture supports independent deployment and evolution
5. **Reviewability**: Changes tell a complete story about the tool's design

## Module Architecture

### Layer 1: Types (`types/`)

**Responsibility**: Data shape definitions and contracts

```
types/
├── vendor.ts          # Vendor entity and profiles
├── tracking.ts        # Mail tracking and communication records
├── analytics.ts       # Metrics and reporting data
└── index.ts           # Public exports
```

**Key Constraints**:

- No imports from other layers
- Pure data type definitions
- Used as contracts between layers

### Layer 2: Services (`services/`)

**Responsibility**: Business logic, state operations, and external integrations

```
services/
├── VendorService.ts       # Vendor CRUD and profile management
├── TrackingService.ts     # Communication tracking and history
├── AnalyticsService.ts    # Metrics and reporting
└── index.ts               # Public service exports
```

**Dependencies**:

- Imports from: `types/`
- Optional main-app imports: Documented explicitly in service file headers
- External integrations: Via dependency injection

**Key Constraints**:

- No direct DOM operations
- No React-specific logic
- Easily testable with mock injections
- Services are stateless; state is injected

### Layer 3: Hooks (`hooks/`)

**Responsibility**: React state management and side-effect orchestration

```
hooks/
├── useVendor.ts              # Vendor data fetching and management
├── useTracking.ts            # Communication tracking state
├── useVendorAnalytics.ts     # Analytics aggregation
├── useVendorSearch.ts        # Search and filtering logic
└── index.ts                  # Public hook exports
```

**Dependencies**:

- Imports from: `types/`, `services/`
- React hooks: `useState`, `useEffect`, `useCallback`, `useMemo`
- No direct main-app imports (use service injection)

**Key Constraints**:

- Hooks are pure functions of their inputs
- Side effects are explicit and testable
- Return stable, memoized values
- Compose services cleanly

### Layer 4: Components (`components/`)

**Responsibility**: UI presentation and user interaction

```
components/
├── vendor/
│   ├── VendorCard.tsx
│   ├── VendorList.tsx
│   ├── VendorDetail.tsx
│   └── index.ts
├── tracking/
│   ├── TrackingTimeline.tsx
│   ├── CommunicationLog.tsx
│   └── index.ts
├── analytics/
│   ├── VendorMetrics.tsx
│   ├── TrackingStats.tsx
│   └── index.ts
└── index.ts
```

**Dependencies**:

- Imports from: `types/`, `hooks/`, local components
- Design system: Via documented public interface (future)
- No service imports (use hooks)

**Key Constraints**:

- Components are pure functions of props and local state
- All state managed via hooks
- No direct data-fetching logic
- Composable and reusable

### Layer 5: Tests (`tests/`)

**Responsibility**: Quality assurance and specification

```
tests/
├── unit/
│   ├── services/          # Service logic tests
│   ├── hooks/             # Hook behavior tests
│   └── components/        # Component rendering tests
├── integration/
│   ├── workflows.test.ts  # End-to-end workflows
│   └── services.test.ts   # Service integration
└── fixtures.ts            # Shared test data
```

**Dependencies**:

- Imports from: All modules (as under test)
- Test utilities: Local or standard (`vitest`, `@testing-library/react`)
- Fixtures: Local mocks and builders

**Key Constraints**:

- Tests do not import from main app
- Fixtures are complete and self-contained
- Tests document expected behavior
- All critical paths are covered

## Data Flow

### Vendor Discovery & Tracking

```
User Action (Component)
      ↓
Hook (useVendor, useTracking)
      ↓
Service (VendorService, TrackingService)
      ↓
Local State / Fixtures (No external data source yet)
      ↓
Component Render
```

### Analytics & Reporting

```
Tracking Data (Services)
      ↓
Analytics Service (Aggregation)
      ↓
Hook (useVendorAnalytics)
      ↓
Component (VendorMetrics)
      ↓
UI Display
```

## State Management

### Current Approach (V2 - Isolated)

- Component-level state via `useState`
- Hook-based state composition
- Local fixtures for data
- No external backend connection

### Future Integration (Follow-up Issue)

- Transition to main app state management if needed
- Connection to central database
- Real-time synchronization

## Dependency Graph

```
Components ─→ Hooks ─→ Services ─→ Types
                ↓
           fixtures (tests)
```

**One-way dependency flow ensures**:

- Components don't know about services directly
- Services don't depend on components
- Types are universal and stable
- Easy to test each layer in isolation

## Testing Strategy

### Unit Tests

- Test each service method independently
- Test hooks with mock services
- Test components with mock hooks
- Use local fixtures

### Integration Tests

- Test workflows (e.g., vendor creation → tracking → analytics)
- Use realistic fixture combinations
- Verify hook + service integration

### Contract Tests (Future)

- Document expected interfaces with main app
- Verify contract compliance before integration

## Constraints & Boundaries

### ✅ ALLOWED

- Create new components, services, hooks within this tool
- Define local types and data structures
- Create local fixtures and test data
- Write comprehensive tests
- Document integration requirements
- Use public interfaces from main app (when available)

### ❌ NOT ALLOWED

- Modify main app shell (`src/`)
- Modify main routing system (`src/routes/`)
- Modify inbox architecture (`src/features/mail/`)
- Modify authentication system
- Modify wallet core (`src/services/stellar/`)
- Modify database schema
- Modify main design system
- Add imports to main app files from this tool
- Create circular dependencies

## Integration Points (Future)

When integrating with main app in follow-up issues:

1. **Mail Integration**: Connect tracking to existing mail display
2. **Authentication**: Use main app user context
3. **Navigation**: Link to tool from main dashboard
4. **State**: Optionally sync with main app state management
5. **Design System**: Use main app components (documented interface)

Each integration will be a separate, reviewable issue.

## Maintenance & Evolution

- **Contributors**: Should read this file before modifying the tool
- **Architecture Changes**: Document in this file with rationale
- **New Features**: Extend existing layers following established patterns
- **Refactoring**: Maintain layer boundaries and one-way dependencies
