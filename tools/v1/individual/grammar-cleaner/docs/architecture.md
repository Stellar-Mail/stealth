# Grammar Cleaner — Architecture

## System Design (Plain Language)

The Grammar Cleaner is a self-contained text processing tool. A user pastes or types text into an input area; the tool analyses the text for grammar, spelling, and style issues; and the user reviews and applies suggested corrections.

Everything happens locally — no network calls, no server, no cloud AI. The tool runs entirely in the browser using pure transformation logic.

## Text-Based Data Flow

```
  ┌─────────────────────────────────────────────────────────┐
  │                     User Input                          │
  │  (types or pastes plain text into the editor area)      │
  └────────────────────┬────────────────────────────────────┘
                       │
                       ▼
  ┌─────────────────────────────────────────────────────────┐
  │  GrammarCleanerComponent  (components/GrammarCleaner)   │
  │                                                         │
  │  - Renders textarea + results panel                     │
  │  - Captures keystroke / paste events                    │
  │  - Emits raw text to hook                               │
  │  - Manages cursor + active-correction UI state          │
  └────────────────────┬────────────────────────────────────┘
                       │  onTextChange(rawText)
                       ▼
  ┌─────────────────────────────────────────────────────────┐
  │  useGrammarCleaner  (hooks/useGrammarCleaner)           │
  │                                                         │
  │  - Stores: inputText, status, results[], error          │
  │  - Debounces input before calling service                │
  │  - Caches last result to avoid re-computation           │
  │  - Exposes: { inputText, status, results, setInput,     │
  │              acceptCorrection, rejectCorrection, reset } │
  └────────────────────┬────────────────────────────────────┘
                       │  checkGrammar(text)
                       ▼
  ┌─────────────────────────────────────────────────────────┐
  │  grammarService  (services/grammarService)              │
  │                                                         │
  │  - Pure function: tokenize → analyze → suggest           │
  │  - Returns CorrectionResult[] with position,             │
  │    original text, suggested text, rule ID                │
  │  - No side effects, no async, no React                  │
  └────────────────────┬────────────────────────────────────┘
                       │  CorrectionResult[]
                       ▼
  ┌─────────────────────────────────────────────────────────┐
  │  useGrammarCleaner  (caches, returns to component)      │
  └────────────────────┬────────────────────────────────────┘
                       │  { status, results, ... }
                       ▼
  ┌─────────────────────────────────────────────────────────┐
  │  GrammarCleanerComponent                                 │
  │                                                         │
  │  - Renders correction suggestions inline                 │
  │  - Highlights issues in the original text                │
  │  - Applies accepted corrections to produce clean output  │
  └─────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### Components Layer (`components/`)

- Accept user input via `<textarea>` or contenteditable div.
- Display correction suggestions as inline annotations or a side panel.
- Provide "Accept" / "Ignore" affordances per correction.
- Show a processed/cleaned output preview.
- Zero logic — all data comes from the hook via props.

### Hooks Layer (`hooks/`)

- `useGrammarCleaner` — primary hook, manages input → process → result lifecycle.
- Debounce or throttle input to avoid per-keystroke processing on large texts.
- Call service functions and cache results for stable render output.
- Expose imperative controls: `setText`, `acceptCorrection(index)`, `rejectCorrection(index)`, `reset`.
- Own the `ProcessingStatus` type: `"idle" | "processing" | "done" | "error"`.

### Services Layer (`services/`)

- `grammarService.ts` — main entry point, composes tokenizer + checker + suggester.
- `tokenizer.ts` — splits text into sentences/words with position tracking.
- `ruleEngine.ts` — applies grammar/style rules, returns matches.
- `suggestionEngine.ts` — maps rules → human-readable corrections with replacement text.
- `diffUtils.ts` — computes line-level or word-level diff between original and corrected text.
- All services are pure functions: `(input: string) => Output`. No classes, no singletons, no state.

## Design Principles

1. **Deterministic behavior** — Same input always produces the same output. No randomness unless seeded.
2. **Local state only** — All state lives in the hook as `useState`. No global stores, no context providers.
3. **No external dependencies** — Zero network calls, zero server-side processing, zero cloud APIs.
4. **Unidirectional data flow** — Component → Hook → Service → Result. No reverse calls.
5. **Pure service layer** — Services are callable from Node.js (test runner) without a browser.
6. **Safe for open-source** — All UI text, error messages, and demo content must be fake and public.

## Extension Strategy

Future contributors can extend the tool by:

| Extension               | What to add                                             | Where                  |
| ----------------------- | ------------------------------------------------------- | ---------------------- |
| New grammar rule        | Add rule to `ruleEngine.ts`                             | `services/`            |
| New language            | Add tokenizer variant and rule set per locale           | `services/`            |
| Custom dictionary       | Add `services/dictionary.ts` with allow-list/block-list | `services/`            |
| Correction preview diff | Use `diffUtils.ts` to show before/after                 | `services/`            |
| Keyboard shortcuts      | Add keyboard event handlers in the component            | `components/`          |
| Batch processing        | Accept multi-paragraph input with per-paragraph results | `hooks/` + `services/` |

All extensions MUST obey the dependency direction: UI additions go in `components/`, orchestration in `hooks/`, logic in `services/`.

## What This Architecture Excludes

- No AI or ML model integration (future issue required).
- No spell-check dictionary downloads (must be bundled).
- No multi-language support until locale-aware services are added.
- No real-time collaboration.
- No server-side processing.
- No persistence of user corrections or preferences across sessions.
