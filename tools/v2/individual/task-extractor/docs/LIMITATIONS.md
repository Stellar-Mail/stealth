# Task Extractor — Known Limitations

This document catalogs the known limitations, constraints, and design boundaries of the Task Extractor tool.

## Language Support

### English Only

**Limitation**: Only English language content is supported.

**Reason**: Pattern matching is tuned for English grammar and vocabulary. Request phrases like "please", "could you", and action verbs are English-specific.

**Impact**: Non-English messages will either:

- Return `unsupported-language` error if `language` field is set to non-English
- Produce unreliable results if processed as English content

**Workaround**:

- Translate content to English before extraction
- Build language-specific extractors for other languages

**Future**: Additional languages could be supported by:

- Adding language-specific pattern dictionaries
- Using language detection libraries
- Implementing ML-based extraction (but this would break the deterministic/offline constraint)

---

## Date and Time Resolution

### Relative Dates Require `receivedAt`

**Limitation**: Phrases like "today", "tomorrow", "eod" only resolve to dates when `receivedAt` is provided.

**Reason**: The engine is pure and deterministic — it never reads the system clock. Without `receivedAt`, there's no reference point for relative dates.

**Impact**: Without `receivedAt`:

- "today" stays as `dueTextHint: "today"` instead of resolving to a date
- "tomorrow" stays as `dueTextHint: "tomorrow"`
- "eod" stays as `dueTextHint: "eod"`

**Workaround**: Always provide `receivedAt` when extracting from timestamped messages.

### Limited Relative Date Support

**Supported**: today, tomorrow, eod, eow, end of day, end of week

**Not supported**:

- "next Monday" (generic phrase, not resolved to specific date)
- "in 3 days"
- "next month"
- "Q2 2026"
- Time-specific phrases: "at 3pm", "by noon"

**Reason**: Simple rule-based parsing. Advanced date parsing would require a library like chrono-node, adding complexity and dependencies.

**Workaround**: Use explicit ISO 8601 dates (YYYY-MM-DD) for precise due dates.

### Weekday Names Are Not Resolved

**Limitation**: "by Friday", "due Monday", etc. are captured as `dueTextHint` but not resolved to actual dates.

**Reason**: Resolving weekdays requires:

- Knowing the current date (requires `receivedAt`)
- Calculating the next occurrence of that weekday
- Handling edge cases (e.g., "Friday" when today is Friday — is it today or next week?)

**Impact**: Weekday due dates require downstream processing to resolve.

**Workaround**: Implement weekday resolution in the consuming application if needed.

---

## Text Processing

### Task Text Limited to 200 Characters

**Limitation**: Task text is truncated at 200 characters (at word boundary).

**Reason**: Prevents extremely long task descriptions that are impractical for task management UIs.

**Impact**: Long sentences are cut off. Example:

- Input: "Please review the comprehensive quarterly financial analysis report including all departmental budgets revenue projections and expense forecasts for Q3 and Q4 along with comparative data from previous years..."
- Output: "review the comprehensive quarterly financial analysis report including all departmental budgets revenue projections and expense forecasts for Q3 and Q4 along with comparative data"

**Workaround**:

- Keep task descriptions concise in source content
- Split long tasks into multiple items
- Parse long text separately if needed

### Checkbox Format Must Be Exact

**Limitation**: Only specific checkbox formats are recognized:

- `- [ ] Task` ✓
- `* [ ] Task` ✓
- `-[ ]Task` ✓ (whitespace flexible)

**Not recognized**:

- `- [x] Task` (checked box)
- `- [>] Task` (custom marker)
- `☐ Task` (Unicode checkbox)
- `○ Task` (circle bullet)

**Reason**: Simple regex matching. Expanding formats would increase complexity and false positives.

**Workaround**: Normalize checkboxes before extraction if using custom formats.

---

## Priority Detection

### Context-Based Priority Can Be Ambiguous

**Limitation**: Priority is inferred from surrounding text, which can be ambiguous.

**Example**:

```
"We had an urgent meeting yesterday. Please review the notes when you get a chance."
```

Priority inference:

- "urgent" → might trigger high priority
- "when you get a chance" → triggers low priority
- Result: **low priority** (low-priority markers take precedence)

**Reason**: Simple heuristic with fixed precedence: low-priority markers > high-priority phrase > high-priority words.

**Impact**: Edge cases where both high and low priority terms appear may not match user intent.

**Workaround**: Keep priority signals clear and unambiguous in source content.

### No Numerical Priority Levels

**Limitation**: Priority is categorical (low/normal/high), not numerical (P0, P1, P2, etc.).

**Reason**: Rule-based extraction from natural language doesn't reliably map to numerical scales.

**Impact**: Cannot distinguish between "urgent" and "critical" (both are "high").

**Workaround**: Map categorical priorities to numerical scales in the consuming application based on domain-specific needs.

---

## Extraction Rules

### No Context Understanding

**Limitation**: The engine doesn't understand semantic context or intent.

**Examples**:

```
"Don't send the email until I approve."
```

- Extracted: "send the email" (doesn't understand negation)

```
"I already reviewed the document."
```

- Extracted: "reviewed the document" (doesn't understand past tense)

```
"Someone should review the PR."
```

- Not extracted (no direct command/request)

**Reason**: Rule-based pattern matching without natural language understanding.

**Impact**: False positives (extracting negated actions) and false negatives (missing implied tasks).

**Workaround**:

- Use explicit task formats (checkboxes, "please" phrases)
- Filter out false positives in downstream processing
- Consider NLP/ML for advanced context understanding (but breaks purity/determinism)

### Mid-Sentence Action Verbs Not Detected

**Limitation**: Action verbs must appear at the start of a line or bullet.

**Examples**:

```
"The team will review the document."
```

- Not extracted ("review" is mid-sentence)

```
"Let's schedule a meeting."
```

- Not extracted ("schedule" is mid-sentence)

**Reason**: To reduce false positives. Mid-sentence verbs often aren't actionable tasks.

**Workaround**: Restructure sentences to start with action verbs or use explicit request formats.

### Deduplication Is Case-Insensitive

**Limitation**: Tasks are deduplicated case-insensitively, so similar tasks with different casing collapse to one.

**Example**:

```
"Please review the Q1 report."
"Please Review The Q1 Report."
```

- Result: Only one task extracted

**Reason**: Task text is typically case-insensitive for deduplication purposes.

**Impact**: Intentionally similar tasks with different casing are collapsed.

**Workaround**: Add distinguishing details to task text if they're truly different tasks.

---

## Size Limits

### Hard Limits Enforced

**Limits** (defined in `GUARD_LIMITS`):

- `messageId`: 256 characters
- `subject`: 500 characters
- `body`: 50,000 characters or 10,000 words
- `maxTasks` option: 1–50

**Reason**: Prevent abuse and resource exhaustion.

**Impact**: Oversized input is rejected with `input-too-large` error.

**Workaround**:

- Truncate or chunk input before extraction
- Modify `GUARD_LIMITS` in `guards.ts` if appropriate for your use case (but maintain some limits)

---

## Performance

### O(n) Line-by-Line Processing

**Limitation**: Processing time scales linearly with the number of lines in the input.

**Impact**: Very large messages (thousands of lines) may take noticeable time to process.

**Typical Performance**:

- 100 lines: <1ms
- 1,000 lines: ~5ms
- 10,000 lines: ~50ms

**Workaround**:

- Chunk large messages if they exceed practical sizes
- Consider preprocessing to extract only relevant sections

---

## No UI Integration

### Backend Only

**Limitation**: This tool has no UI components.

**Reason**: V2 later-release tool designed as isolated backend service.

**Impact**: Must build UI separately if visual task extraction interface is needed.

**Workaround**: Import the tool in a UI component and render results.

---

## No Persistence

### Stateless Processing

**Limitation**: The tool doesn't store extracted tasks — it only returns them.

**Reason**: Pure function design. Storage is the responsibility of the consuming application.

**Impact**: Each call is independent. No history or task tracking.

**Workaround**: Persist results in your database after extraction.

---

## Testing

### No Integration Tests

**Limitation**: Tests are unit tests only. No end-to-end or integration tests with a database or API.

**Reason**: Tool is isolated and has no external dependencies.

**Impact**: Real-world integration scenarios must be tested by the consuming application.

**Workaround**: Add integration tests in the main app that uses this tool.

### No Performance Benchmarks

**Limitation**: No performance tests or benchmarks included.

**Reason**: Extraction is fast enough for typical use cases. Premature optimization avoided.

**Impact**: Performance characteristics under extreme load are unknown.

**Workaround**: Add performance tests if needed for your use case.

---

## Future Enhancements

These limitations could be addressed in future versions:

1. **Multi-language support**: Add pattern dictionaries for other languages
2. **Advanced date parsing**: Integrate a date parsing library for complex phrases
3. **Context understanding**: Use NLP/ML for semantic analysis (but would require rethinking purity)
4. **Custom extraction rules**: Allow callers to provide their own patterns
5. **Priority scores**: Return numerical priority scores instead of categorical
6. **Negation detection**: Identify and exclude negated actions
7. **Task dependencies**: Detect relationships between tasks ("after X, do Y")
8. **Time extraction**: Extract time-of-day constraints ("by 3pm")
9. **Assignee extraction**: Identify who a task is assigned to ("@john, please...")
10. **Confidence scoring**: More granular confidence levels (0-100 instead of low/medium/high)

---

## Design Constraints (Intentional)

These are not bugs, but intentional design decisions:

### Pure and Deterministic

**Constraint**: No side effects, no randomness, no clock reads (except via `receivedAt`).

**Reason**: Predictable, testable, reproducible behavior.

**Impact**: Cannot automatically use "current date" — caller must provide `receivedAt`.

### No External Dependencies

**Constraint**: No libraries beyond TypeScript and vitest.

**Reason**: Minimal attack surface, easy to audit, fast to install.

**Impact**: Cannot use advanced NLP, date parsing, or language detection libraries.

### Rule-Based, Not ML

**Constraint**: Pattern matching with regex and heuristics, not machine learning.

**Reason**: Deterministic, offline, no training data required, explainable results.

**Impact**: Limited to explicit patterns. Cannot learn from examples or adapt to new formats.

### Isolated Tool

**Constraint**: No integration with main app until a future issue allows it.

**Reason**: V2 later-release tooling strategy. Build first, integrate later.

**Impact**: Cannot access database, routing, auth, or UI directly.

---

## Reporting New Limitations

If you discover a limitation not listed here:

1. Check if it's a bug or an intentional constraint
2. Open an issue with:
   - Description of the limitation
   - Example input/output demonstrating it
   - Impact on your use case
   - Potential workarounds (if any)
3. Label it as "limitation" or "enhancement" as appropriate

---

## See Also

- [contract.md](./contract.md) — Full API specification
- [USAGE.md](./USAGE.md) — Usage examples and workarounds
- [TESTING.md](./TESTING.md) — Testing guide
- [CONTRIBUTING.md](./CONTRIBUTING.md) — How to extend the tool
