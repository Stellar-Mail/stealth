# Grammar Cleaner — Test Plan

This document defines the test strategy for the Grammar Cleaner tool. **No test framework is assumed.** The plan describes what to test, not how to run it.

## Unit Test Scope

### Service Layer

| Test Area                                          | What to Verify                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `tokenizer.tokenize(text)`                         | Splits sentences on `.?!`, splits words on whitespace/punctuation, preserves position offsets |
| `tokenizer.tokenize("")`                           | Returns empty token array                                                                     |
| `ruleEngine.check(tokens)`                         | Applies rules and returns typed `RuleMatch[]` with position, severity, message                |
| `ruleEngine.check(...)` — no matches               | Returns empty array                                                                           |
| `suggestionEngine.suggest(ruleMatch)`              | Returns `CorrectionSuggestion` with replacement text and rule ID                              |
| `suggestionEngine.suggest(...)` — unsupported rule | Returns null or throws typed error                                                            |
| `grammarService.checkGrammar(text)`                | Composes tokenizer → rules → suggestions correctly                                            |
| `diffUtils.computeDiff(original, corrected)`       | Returns word-level or line-level diff with correct insert/delete/equal segments               |
| `diffUtils.computeDiff(identical, identical)`      | Returns all-equal diff                                                                        |

### Hook Layer (useGrammarCleaner)

| Test Area             | What to Verify                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Initial state         | `inputText === ""`, `status === "idle"`, `results === []`, `error === null`                  |
| `setText(text)`       | Updates `inputText`, transitions `status → "processing"`, eventually `→ "done"` with results |
| `acceptCorrection(i)` | Applies correction `i` to text, updates `results` list, removes that suggestion              |
| `rejectCorrection(i)` | Removes suggestion `i` without changing text                                                 |
| `reset()`             | Returns to initial state                                                                     |
| Race condition        | Rapid `setText` calls only process the latest value (debounce / cancel previous)             |
| Empty input           | `setText("")` → status returns to `"idle"`, no processing                                    |

### Component Layer (GrammarCleaner)

| Test Area           | What to Verify                                                             |
| ------------------- | -------------------------------------------------------------------------- |
| Render empty state  | Shows textarea placeholder, no results panel                               |
| Render with results | Shows inline highlights or suggestion list                                 |
| Accept click        | Calls `acceptCorrection` from hook                                         |
| Reject click        | Calls `rejectCorrection` from hook                                         |
| Large input         | No crash, scrollable textarea, processing completes within reasonable time |

## Edge Cases

| Edge Case                                          | Expected Behavior                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Empty string                                       | No corrections suggested, status stays idle                                                             |
| Single character                                   | Treated as valid unless the rule engine covers single-char errors                                       |
| Punctuation-heavy input (`"!?.,;:!?"`)             | Tokenizer produces individual punctuation tokens; rules may flag repeated punctuation                   |
| Whitespace-only input                              | Treated as empty input                                                                                  |
| Very long text (10,000+ chars)                     | Debounce prevents per-keystroke processing; service operates synchronously with acceptable frame budget |
| Text with only numbers                             | No grammar rules apply — zero corrections, status = done                                                |
| Unicode / emoji                                    | Tokenizer handles grapheme clusters; rules do not modify non-text characters                            |
| Repeated identical errors                          | Each occurrence reported independently; accepting one does not affect others                            |
| Script injection ("<script>alert('xss')</script>") | Service treats as literal text; output is escaped by React rendering — verified in component tests      |

## Manual Validation Checklist

After building the tool, verify the following manually:

- [ ] Type into the textarea — results appear after a brief debounce delay
- [ ] Click "Accept" on a correction — the text updates and the suggestion disappears
- [ ] Click "Ignore" / "Reject" — the suggestion disappears without text change
- [ ] Paste a large document (5,000+ characters) — no freeze, results appear within 1 second
- [ ] Paste text with no errors — empty results state, status shows "No issues found"
- [ ] Press Reset / Clear — input clears, results reset to initial state
- [ ] Rapid typing — no stale results, no out-of-order corrections
- [ ] Keyboard navigation — Tab through suggestions, Enter to accept, Escape to dismiss
- [ ] Screen reader test — corrections are announced via aria-live region
- [ ] Paste script tags — displayed as literal text, not executed

## OSS Verification Steps

Before submitting a Grammar Cleaner PR:

- [ ] All tests pass (unit + hook + component)
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] No Prettier issues (`prettier --check`)
- [ ] No files changed outside `tools/v1/individual/grammar-cleaner/`
- [ ] No imports from `src/` outside this folder
- [ ] No network requests, localStorage, or global state
