# Grammar Cleaner Test Plan

## Unit Scenarios

1. Detects and corrects common homophone errors (their/there/they're, your/you're, its/it's).
2. Capitalizes "i" to "I" in all positions.
3. Detects and removes filler/redundant words (just, really, basically, actually, very).
4. Fixes punctuation spacing (space before comma, period, etc.).
5. Returns zero issues for already-clean text.
6. Rejects empty body input with a validation error.
7. Rejects unsupported input shape with a typed error.
8. Produces deterministic output for repeated cleaning of the same fixture.
9. Processes all sample fixtures without error.
10. Guards reject input exceeding character or word limits.
11. Guards sanitize control and invisible characters before the engine runs.
12. Maps engine results to UI-ready states via toReadyState.

## Component Scenarios

1. Shows empty/input state with textarea and submit button initially.
2. Submit button is disabled when textarea is empty, enabled when text is present.
3. Loading state shows spinner with aria-busy and polite live region.
4. Error state shows message and retry button (when handler provided).
5. Error state omits retry button when no handler provided.
6. Ready state shows issues list grouped by category with crossed-out original and green suggestion.
7. Ready state shows corrected text with green background.
8. Ready state shows original text for comparison.
9. Ready state shows "Check Another" button to reset.
10. Keyboard shortcut Ctrl+Enter / Cmd+Enter triggers check from textarea.
11. Root GrammarCleaner component switches states correctly based on status.

## Non-Goals for This Folder

- End-to-end inbox routing.
- Database persistence.
- Real AI-provider integration (V1 uses rule-based engine only).
- Main app routing or navigation integration.
- Design system or shared component usage.
