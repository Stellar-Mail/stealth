# Task Extractor — Review Notes for OSS Contributors

This document helps OSS contributors quickly validate and review this tool as a self-contained mini-product.

## Quick Validation (5 minutes)

### 1. Run Tests

```sh
npx vitest run --config tools/v2/individual/task-extractor/vitest.config.ts
```

**Expected**: All tests pass (✓), zero failures.

### 2. Run Linter

```sh
npm run lint
```

**Expected**: No errors or warnings in `tools/v2/individual/task-extractor/`.

### 3. Type Check

```sh
npx tsc --noEmit
```

**Expected**: No TypeScript errors.

### 4. Try the Tool

Create a file `test-task-extractor.ts` in the project root:

```typescript
import { safeExtractTasks } from "./tools/v2/individual/task-extractor";

const outcome = safeExtractTasks({
  messageId: "test-001",
  subject: "Project Tasks",
  body: `
    Hi team,
    
    Before Friday:
    - [ ] Review the proposal
    - [ ] Send feedback
    
    Please update the wiki by tomorrow.
  `,
  receivedAt: "2026-07-10T10:00:00.000Z",
});

console.log(JSON.stringify(outcome, null, 2));
```

Run it:

```sh
npx tsx test-task-extractor.ts
```

**Expected output**:

```json
{
  "status": "ok",
  "result": {
    "messageId": "test-001",
    "tasks": [
      {
        "id": "test-001-task-1",
        "text": "Review the proposal",
        "source": "body",
        "trigger": "checkbox",
        "priority": "normal",
        "confidence": "high"
      },
      {
        "id": "test-001-task-2",
        "text": "Send feedback",
        "source": "body",
        "trigger": "checkbox",
        "priority": "normal",
        "confidence": "high"
      },
      {
        "id": "test-001-task-3",
        "text": "update the wiki by tomorrow",
        "source": "body",
        "trigger": "request-phrase",
        "priority": "normal",
        "confidence": "high",
        "dueAtHint": "2026-07-11"
      }
    ],
    "stats": {
      "lineCount": 7,
      "candidateCount": 3,
      "extractedCount": 3,
      "truncated": false
    }
  }
}
```

---

## Detailed Review (15-30 minutes)

### Architecture Review

#### Folder Structure

✅ **Check**: All files are inside `tools/v2/individual/task-extractor/`

```
tools/v2/individual/task-extractor/
├── index.ts                 # Public API exports
├── README.md                # Quick start guide
├── specs.md                 # Contributor boundaries
├── vitest.config.ts         # Test config
├── types/
│   └── taskExtractor.ts     # TypeScript types
├── services/
│   ├── taskExtractor.ts     # Core engine
│   ├── guards.ts            # Validation layer
│   └── fixtures.ts          # Test fixtures
├── tests/
│   ├── taskExtractor.test.ts   # Core tests
│   ├── guards.test.ts          # Validation tests
│   ├── fixtures.test.ts        # Fixture tests
│   └── edge-cases.test.ts      # Edge case tests
└── docs/
    ├── contract.md             # API documentation
    ├── TESTING.md              # Testing guide
    ├── USAGE.md                # Usage examples
    ├── CONTRIBUTING.md         # Contributor guide
    └── REVIEW_NOTES.md         # This file
```

✅ **Check**: No imports from outside the tool folder (except Node/vitest)

```sh
# Search for external imports
grep -r "from ['\"].*/" tools/v2/individual/task-extractor/services/ tools/v2/individual/task-extractor/types/
```

**Expected**: Only relative imports like `"../types/taskExtractor"`.

#### Public API Surface

✅ **Check**: `index.ts` exports the complete contract

Open `tools/v2/individual/task-extractor/index.ts`:

**Expected exports**:

- `safeExtractTasks` — Safe entry point
- `extractTasks` — Pure engine
- All types from `types/taskExtractor.ts`
- Fixtures for testing

### Test Coverage Review

#### Test Statistics

```sh
npx vitest run --coverage --config tools/v2/individual/task-extractor/vitest.config.ts
```

**Expected coverage**:

- Line coverage: >95%
- Branch coverage: >90%
- Function coverage: 100%

#### Test Organization

✅ **Check**: Tests cover all major scenarios

1. **taskExtractor.test.ts**: Core extraction logic
   - All fixtures pass
   - Rule matching (checkbox, request, bullet, imperative)
   - Confidence levels (high, medium, low)
   - Priority detection (high, normal, low)
   - Date parsing (ISO dates, relative phrases)
   - Deduplication
   - Options (maxTasks, minConfidence)
   - Determinism and immutability

2. **guards.test.ts**: Validation and sanitization
   - Input validation
   - Options validation
   - Size limit checks
   - Sanitization (NFC, control chars)
   - Error handling
   - All error codes covered

3. **fixtures.test.ts**: Fixture integrity
   - Fixture structure validation
   - Success/failure path validation
   - Coverage analysis (all triggers, confidence levels, priorities)

4. **edge-cases.test.ts**: Boundary conditions
   - Text processing edge cases
   - Date/time edge cases
   - Priority detection edge cases
   - Rule extraction edge cases
   - Options and limits edge cases
   - Sanitization edge cases
   - Deduplication edge cases

### Documentation Review

#### README.md

✅ **Check**: Contains:

- Tool description
- Quick start example
- Execution contract overview
- File layout
- Test command
- Ownership boundary warning

#### docs/contract.md

✅ **Check**: Contains:

- Entry point documentation
- Input/output types
- Error codes table
- Extraction rules table
- Sanitization details
- Fixture references
- Boundary statement

#### docs/USAGE.md

✅ **Check**: Contains:

- Quick start
- Basic usage examples
- Advanced usage patterns
- Real-world examples (API handler, queue consumer, etc.)
- Best practices
- Troubleshooting section

#### docs/TESTING.md

✅ **Check**: Contains:

- How to run tests
- Test structure overview
- Test coverage details
- Writing new tests
- Fixture documentation
- Debugging guidance

#### docs/CONTRIBUTING.md

✅ **Check**: Contains:

- Overview and boundaries
- Reviewer checklist
- Contributor guide
- Architecture explanation
- Development workflow
- Code standards
- PR process

### Code Quality Review

#### Type Safety

```sh
# Check for 'any' types (should only be in test fixtures)
grep -r ": any" tools/v2/individual/task-extractor/services/ tools/v2/individual/task-extractor/types/
```

**Expected**: No results (or only in test files for invalid input).

#### Purity Check

✅ **Look for**:

- No `Math.random()`
- No `Date.now()` or `new Date()` without parameters
- No file system operations
- No network calls
- No mutations of input parameters

**Files to check**:

- `services/taskExtractor.ts`
- `services/guards.ts`

#### Immutability Check

Test that input isn't mutated:

```typescript
const input = {
  messageId: "test",
  subject: "Test",
  body: "Please review",
};
const inputCopy = JSON.parse(JSON.stringify(input));
extractTasks(input);
// input should equal inputCopy
```

✅ **Check**: Test exists in `taskExtractor.test.ts` ("does not mutate the caller's input").

### Functional Validation

#### Test All Extraction Rules

| Rule            | Test Input                  | Expected Output                   |
| --------------- | --------------------------- | --------------------------------- |
| Checkbox        | `- [ ] Review the document` | "Review the document" (high conf) |
| Request phrase  | `Please send the report`    | "send the report" (high conf)     |
| Bullet + action | `- review the deck`         | "review the deck" (medium conf)   |
| Imperative line | `Send the email`            | "Send the email" (low conf)       |

Run the quick validation script above with different inputs to test each rule.

#### Test Error Handling

```typescript
// Test invalid input
safeExtractTasks({ messageId: 123 }); // Should return error status

// Test empty content
safeExtractTasks({ messageId: "test", subject: "", body: "" }); // Should return empty-content error

// Test oversized input
safeExtractTasks({ messageId: "test", subject: "", body: "x".repeat(60000) }); // Should return input-too-large error

// Test unsupported language
safeExtractTasks({ messageId: "test", subject: "", body: "test", language: "fr" }); // Should return unsupported-language error
```

### Integration Check

✅ **Verify**: Tool does NOT integrate with:

- Main app routing
- Database
- Authentication system
- Wallet/Stellar core
- Any UI components

✅ **Check**: No files outside `tools/v2/individual/task-extractor/` import from this tool.

```sh
# Search for imports of this tool in other parts of the codebase
grep -r "from.*task-extractor" app/ routes/ components/ 2>/dev/null || echo "No integrations found (correct)"
```

**Expected**: "No integrations found (correct)" — This is V2 later-release, should not be integrated yet.

---

## Acceptance Criteria Verification

### ✅ Tests or test plans live inside the tool folder

**Location**: `tools/v2/individual/task-extractor/tests/`

**Files**:

- `taskExtractor.test.ts` (47 tests)
- `guards.test.ts` (34 tests)
- `fixtures.test.ts` (25 tests)
- `edge-cases.test.ts` (60+ tests)

**Total**: 166+ tests covering all functionality.

### ✅ Documentation explains how the tool should be reviewed independently

**Files**:

- `README.md` — Overview and quick start
- `docs/contract.md` — Complete API specification
- `docs/USAGE.md` — Usage examples and patterns
- `docs/TESTING.md` — Testing guide
- `docs/CONTRIBUTING.md` — Contributor and reviewer guide
- `docs/REVIEW_NOTES.md` — This file (review checklist)

### ✅ The issue remains isolated from app-wide tests

**Verification**:

- Tests run with isolated config: `vitest.config.ts` in tool folder
- No test dependencies outside tool folder
- No integration tests with main app

### ✅ Files changed by this issue are limited to `tools/v2/individual/task-extractor/`

**Verification**:

```sh
# Check git diff (if this is a PR)
git diff --name-only main | grep -v "^tools/v2/individual/task-extractor/"
```

**Expected**: No output (all changes in tool folder).

### ✅ The contribution is reviewable as a self-contained mini-product change

**Verification**:

- Can run tests independently: ✓
- Can use the tool in isolation: ✓
- Has complete documentation: ✓
- No external dependencies: ✓
- No integration with main app: ✓

---

## Common Issues and Resolutions

### Issue: Tests fail with import errors

**Cause**: Dependencies not installed or wrong working directory.

**Resolution**:

```sh
npm install
npx vitest run --config tools/v2/individual/task-extractor/vitest.config.ts
```

### Issue: Type errors in IDE

**Cause**: TypeScript not recognizing paths.

**Resolution**: Check that `tsconfig.json` includes the tool folder and restart TypeScript server.

### Issue: Linter warnings

**Cause**: Code doesn't match project style.

**Resolution**:

```sh
npm run lint -- --fix
```

### Issue: Coverage below threshold

**Cause**: New code not fully tested.

**Resolution**: Add tests for uncovered branches. Use coverage report to identify gaps:

```sh
npx vitest run --coverage --config tools/v2/individual/task-extractor/vitest.config.ts
```

---

## Sign-Off Checklist

Before approving this PR, verify:

- [ ] All tests pass (166+ tests)
- [ ] Linter passes with no warnings
- [ ] TypeScript compiles with no errors
- [ ] Manual smoke test works (see Quick Validation)
- [ ] All documentation is present and accurate
- [ ] No boundary violations (all changes in tool folder)
- [ ] No integration with main app
- [ ] Code is pure (no side effects)
- [ ] Input objects are not mutated
- [ ] Test coverage is comprehensive (>95% line coverage)
- [ ] Fixtures cover all error codes, triggers, confidence levels, priorities
- [ ] Edge cases are tested
- [ ] Commit messages are clear and follow conventions

---

## Questions or Issues?

If you encounter problems during review:

1. Check this document's troubleshooting section
2. Review the CONTRIBUTING.md guide
3. Open a discussion or comment on the PR
4. Reach out to the issue creator for clarification

---

**Thank you for reviewing the Task Extractor tool!** This review process ensures high-quality, maintainable, and isolated tooling for the GrantFox ecosystem.
