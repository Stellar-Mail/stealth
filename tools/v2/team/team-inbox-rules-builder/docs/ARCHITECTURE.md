# Team Inbox Rules Builder - Architecture

This document describes the architecture and design patterns for the Team Inbox Rules Builder tool.

## Overview

The Team Inbox Rules Builder is a **self-contained, isolated tool** for creating and managing automated inbox rules. It operates independently with local data services and does not depend on the main application.

## Architecture Diagram

```
┌─ User Interface Layer ──────────────────────────────────┐
│                                                          │
│  TeamInboxRulesBuilder (Main Container)                 │
│  ├─ RuleList (Browse, search, filter rules)            │
│  ├─ RuleBuilder (Create/edit rule conditions/actions)  │
│  ├─ RulePreview (Evaluate rule against sample mail)    │
│  └─ State Components                                   │
│      ├─ EmptyState                                     │
│      ├─ LoadingState                                   │
│      ├─ ErrorState                                     │
│      └─ SuccessState                                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌─ State Management ──────────────────────────────────────┐
│                                                          │
│  Custom Hooks                                           │
│  ├─ useRules (rule CRUD, search, filter)               │
│  └─ useRuleEvaluation (test rule against input)        │
│                                                          │
└──────────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌─ Business Logic Layer ───────────────────────────────────┐
│                                                          │
│  Services                                               │
│  ├─ RuleStorageService (in-memory CRUD + import/export) │
│  └─ RuleEngineService (condition matching, action exec) │
│                                                          │
└──────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Data Layer ────────────────────────────────────────────┐
│                                                          │
│  In-Memory Storage (+ Optional JSON export/import)     │
│  ├─ Rule definitions                                   │
│  ├─ Condition groups                                   │
│  ├─ Action configurations                              │
│  └─ Rule evaluation state                              │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌─ Test Fixtures & Documentation ─────────────────────────┐
│                                                          │
│  ├─ Mock rule data                                      │
│  ├─ Architecture guide                                  │
│  ├─ Accessibility guide                                 │
│  └─ Visual style guide                                  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Component Structure

### UI Components (`components/`)

#### TeamInboxRulesBuilder

- **Purpose**: Main container orchestrating rule management workflow
- **State**: Current view (list/builder/preview/loading/error/success)
- **Responsibility**: Managing view transitions, coordinating rule operations

#### RuleList

- **Purpose**: Display sortable, filterable list of rules
- **Features**:
  - Keyboard navigation (arrow keys)
  - Search by name or condition
  - Filter by status (active/inactive)
  - Enable/disable toggle
  - Sort by name, priority, last modified
- **Accessibility**: ARIA list semantics, keyboard support

#### RuleBuilder

- **Purpose**: Create or edit a rule with conditions and actions
- **Features**:
  - Condition builder (field, operator, value)
    - From sender, subject keywords, priority, has attachments, etc.
  - Action selector (file to folder, forward, flag, notify, auto-reply)
  - AND/OR condition grouping
  - Priority ordering
  - Name and description fields
  - Form validation
  - Keyboard shortcuts
- **Accessibility**: Proper label associations, fieldset grouping, keyboard support

#### RulePreview

- **Purpose**: Test a rule against sample mail input
- **Features**:
  - Input mock email fields
  - Run evaluation and see matched/missed results
  - Visual feedback for each condition
- **Accessibility**: Live regions for evaluation results

#### State Components

- **EmptyState**: No rules defined yet
- **LoadingState**: Processing rule operation
- **ErrorState**: Error during save/evaluation
- **SuccessState**: Confirmation after rule saved

### Custom Hooks (`hooks/`)

#### useRules

- **Purpose**: Manage rule CRUD operations and list state
- **Methods**:
  - `addRule(input)`: Create a new rule
  - `updateRule(id, changes)`: Update existing rule
  - `deleteRule(id)`: Remove a rule
  - `getRule(id)`: Retrieve single rule
  - `getAllRules()`: List all rules
  - `searchRules(query)`: Search by name or conditions
  - `toggleRule(id)`: Enable/disable a rule
- **State**: `rules`, `isLoading`, `error`

#### useRuleEvaluation

- **Purpose**: Test rules against sample input
- **Methods**:
  - `evaluate(rules, sampleMail)`: Run rules against a mock email
  - `clearResults()`: Reset evaluation state
- **State**: `results`, `isEvaluating`, `error`

### Services (`services/`)

#### RuleStorageService

- **Singleton**: Single instance across the tool
- **Methods**:
  - `addRule()`: Store a new rule
  - `getRule()`: Retrieve by ID
  - `getAllRules()`: Get all rules
  - `updateRule()`: Update rule properties
  - `deleteRule()`: Remove a rule
  - `importRules(json)`: Import from JSON
  - `exportRules()`: Export all rules as JSON
- **Storage**: In-memory Map

#### RuleEngineService

- **Stateless**: Pure evaluation logic
- **Methods**:
  - `evaluate(rule, mailContext)`: Test single rule against mail
  - `evaluateAll(rules, mailContext)`: Run all applicable rules
  - `validateCondition(condition)`: Check condition validity
  - `getMatchingConditions(rule, mailContext)`: List matched conditions
- **Logic**: Condition matching with AND/OR group support

### Type Definitions (`types/`)

```typescript
// Field operators
type ConditionOperator =
  | "equals"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "matches"
  | "greaterThan"
  | "lessThan"
  | "exists"
  | "notExists";

// Condition fields
type ConditionField =
  | "from"
  | "to"
  | "subject"
  | "body"
  | "priority"
  | "hasAttachments"
  | "receivedAfter"
  | "receivedBefore"
  | "label"
  | "customHeader";

// Single condition
interface Condition {
  id: string;
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
}

// Condition group (AND/OR)
interface ConditionGroup {
  id: string;
  logic: "and" | "or";
  conditions: Condition[];
}

// Available actions
type RuleActionType =
  "fileToFolder" | "forwardTo" | "markAs" | "flag" | "notify" | "autoReply" | "addLabel" | "delete";

// Action configuration
interface RuleAction {
  id: string;
  type: RuleActionType;
  config: Record<string, string>;
}

// Rule definition
interface InboxRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditionGroups: ConditionGroup[];
  actions: RuleAction[];
  createdAt: string;
  updatedAt: string;
}

// Rule evaluation result
interface RuleEvaluationResult {
  ruleId: string;
  matched: boolean;
  matchedConditions: string[];
  triggeredActions: RuleAction[];
}

// Mail context for evaluation
interface MailContext {
  from: string;
  to: string[];
  subject: string;
  body: string;
  priority: "low" | "normal" | "high";
  hasAttachments: boolean;
  receivedAt: string;
  labels: string[];
  headers: Record<string, string>;
}
```

## Data Flow

### Rule Management Workflow

```
1. User opens TeamInboxRulesBuilder
   ├─ useRules fetches all rules from RuleStorageService
   ├─ RuleList displays rules
   └─ EmptyState shown if no rules exist

2. User creates new rule
   ├─ RuleBuilder form displayed
   ├─ User fills name, description
   ├─ User adds condition groups with conditions
   ├─ User selects actions
   └─ User saves rule

3. Save rule
   ├─ Client-side validation
   ├─ RuleStorageService stores rule in memory
   ├─ SuccessState shown
   └─ Return to RuleList with new rule visible

4. User edits existing rule
   ├─ RuleBuilder pre-populated with rule data
   ├─ User modifies conditions/actions
   ├─ RuleStorageService updates rule
   └─ SuccessState shown

5. User tests rule (preview)
   ├─ RulePreview shows mock mail input form
   ├─ User fills sample mail fields
   ├─ RuleEngineService evaluates rule
   ├─ Results displayed per condition
   └─ Visual feedback for matched/missed
```

### Rule Evaluation Flow

```
Mail Context Input
    ↓
RuleEngineService.evaluateAll(rules, mailContext)
    ↓
For each enabled rule:
    ↓
  For each condition group:
    ↓
    AND group: ALL conditions must match
    OR group: ANY condition must match
    ↓
  Rule matched → collect actions
  Rule not matched → skip
    ↓
Return aggregated results
```

## State Management Pattern

### Local State

- Component-level state with useState
- Hook-based state management (custom hooks)
- No external state library required

### Service State

- Singleton service for rule storage
- In-memory storage by default
- JSON export/import for portability

### Flow

```
User Action (onClick, onChange)
    ↓
Event Handler
    ↓
State Update (useState/hook)
    ↓
Service Operation (if needed)
    ↓
State Updated
    ↓
Component Re-render
```

## Boundary Conditions

### What's Inside This Tool

✅ UI components for rule management
✅ Rule builder with conditions and actions
✅ Rule evaluation/preview engine
✅ Local data services
✅ State management hooks
✅ Mock fixtures
✅ Accessibility features
✅ Documentation

### What's NOT Inside This Tool

❌ Main app routing
❌ Authentication system
❌ Wallet integration
❌ Stellar blockchain integration
❌ Inbox or mail rendering
❌ Database persistence
❌ API endpoints
❌ Real mail delivery or fetching

## Extension Points

For future integration, external code can:

- Provide real inbox rules via a data adapter
- Wire rule evaluation into mail processing pipeline
- Persist rules via database adapter
- Add new condition fields or operators
- Add new action types
- Integrate with notification system

But CANNOT:

- Modify shared design system
- Wire into main app routing
- Access wallet or Stellar core
- Modify database schema
- Change authentication

## Accessibility Architecture

### Keyboard Navigation

- **Tab**: Move between interactive elements
- **Shift+Tab**: Move backward
- **Arrow Keys**: Navigate rule list items
- **Enter/Space**: Activate elements
- **Escape**: Cancel operations
- **Ctrl+S**: Save current rule
- **Ctrl+E**: Toggle rule enabled/disabled

### Screen Reader Support

- Semantic HTML (form, fieldset, legend, list)
- ARIA labels and descriptions
- Live regions for status updates
- Clear heading hierarchy
- Status conveyed beyond color

### Visual Accessibility

- Focus indicators with visible ring
- WCAG AA color contrast (4.5:1)
- Respects prefers-reduced-motion

## Styling Strategy

- Uses existing design system tokens (colors, spacing, typography)
- Tailwind CSS for component styling
- No modifications to shared design system

## Testing Strategy

### Unit Tests

- Service methods (CRUD, evaluation)
- Condition matching logic
- Validation functions
- Component rendering

### Integration Tests

- Full workflow (list → create → preview → save)
- Edge cases (empty rules, complex conditions)
- Error handling

### Accessibility Tests

- Keyboard navigation
- Screen reader compatibility
- Color contrast
- Focus management

## Performance Considerations

### Optimization

- Memoization of rule list for large rule sets
- Efficient re-renders with proper key usage
- Debounced search input
- Lazy evaluation preview

### Limitations

- In-memory storage limited by browser memory
- No server-side rule processing
- No real-time updates
- Evaluation is synchronous (may block UI for large rule sets)

## Security Considerations

- No real mail processing or credentials
- Input validation on all rule fields
- Type checking with TypeScript
- Sanitization of user-provided conditions

## Future Enhancements

### Phase 2 (Core Engine)

- Rule CRUD service implementation
- Condition matching engine
- Action configuration logic

### Phase 3 (UI Components)

- Rule list with search and filter
- Rule builder form with validation
- Rule preview panel
- State components (empty, loading, error, success)

### Phase 4 (Testing & Documentation)

- Unit tests with Vitest
- E2E tests with Playwright
- Expanded documentation

### Phase 5 (Integration)

- Route integration with main app
- Real rules data integration
- Database persistence
- Mail processing pipeline integration

---

This architecture ensures the tool is **isolated, maintainable, testable, and accessible** while remaining ready for future integration.
