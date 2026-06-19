# Team Inbox Rules Builder - Test Plan

## Unit Tests

### Types

- Verify all type definitions compile correctly
- Validate required vs optional fields

### Services

#### RuleStorageService

- Create rule from valid input
- Retrieve rule by ID
- Retrieve all rules (sorted by priority)
- Update rule (partial and full)
- Delete existing rule
- Toggle rule enabled/disabled
- Search rules by name and description
- Export rules to JSON
- Import rules from JSON
- Handle non-existent rule retrieval (returns undefined)
- Handle non-existent rule update (returns undefined)
- Handle non-existent rule deletion (returns false)

#### RuleEngineService

- Evaluate single rule with matching conditions
- Evaluate single rule with non-matching conditions
- Evaluate all enabled rules
- Skip disabled rules
- AND condition group (all must match)
- OR condition group (any must match)
- All operator types (equals, contains, startsWith, endsWith, matches, exists, notExists)
- Priority field matching
- Subject field matching
- From field matching
- Body field matching
- HasAttachments field matching
- Invalid regex in matches operator (graceful fallback)

### Hooks

#### useRules

- Initial state has empty rules and no error
- fetchRules populates rules
- addRule adds rule to list
- updateRule updates existing rule
- deleteRule removes rule from list
- toggleRule flips enabled state
- searchRules filters results
- clearError clears error state

#### useRuleEvaluation

- Initial state has no results
- evaluate returns results for enabled rules
- clearResults resets state

### Components

- EmptyState renders call-to-action
- LoadingState shows spinner and message
- ErrorState displays error message and retry
- SuccessState displays success message

### Fixtures

- Mock rules have valid structure
- Mock mail contexts have valid structure
- Helper functions return correct subsets

## Integration Tests

### Rule Lifecycle

- Create → Read → Update → Delete cycle
- Toggle enable/disable
- Search across rules

### Rule Evaluation

- Run evaluation with multiple rules
- Verify matching order by priority
- Handle empty rule sets
- Handle disabled rules correctly

### State Components

- Transition between empty → loaded states
- Error state with retry action

## Accessibility Tests

### Keyboard Navigation

- Tab through all interactive elements
- Enter/Space activates buttons
- Escape cancels operations

### Screen Reader

- ARIA roles present on state components
- Live regions announce loading and errors
- Form controls have proper labels

### Visual

- Focus indicators visible on all interactive elements
- Color contrast meets WCAG AA
- Status not conveyed by color alone

## Test Fixtures

Use `fixtures/rules.fixtures.ts` as the baseline seed set. It covers:

- Multiple rules with various condition configurations
- Enabled and disabled rules
- Rules with single and multiple condition groups
- Rules with AND and OR logic
- Various action types
- Realistic mail contexts for evaluation testing
