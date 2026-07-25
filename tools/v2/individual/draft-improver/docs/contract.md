# Draft Improver — Execution Contract

Stable backend-facing contract for analyzing draft emails independently
of any presentation layer.

## Entry points

| Export | Kind | Use when |
| --- | --- | --- |
| safeImproveDraft(input: unknown, options?: unknown): SafeDraftResult | Guarded service entry point | Caller input is untrusted |
| improveDraft(input: DraftInput, options?: DraftOptions): DraftResult | Pure engine | Input is already validated |

Both functions are pure and deterministic: no network calls, no mailbox access,
no randomness, no clock reads, and no mutation of caller-supplied objects.

## Input

DraftInput: draftId (required), subject (string), body (plain text), language (BCP 47, en only)
DraftOptions: includeSuggestions (default true), maxSuggestions (1-50, default 20)

## Output

DraftResult: draftId, score [0-100], grade (excellent/good/fair/poor), suggestions[], metrics, stats

DraftSuggestion types: wordy-phrase, jargon, long-sentence, passive-voice, missing-greeting,
missing-closing, missing-subject, aggressive-tone, passive-aggressive

Severity: info, warn, critical

## Error codes

invalid-input, invalid-options, input-too-large, empty-content, unsupported-language

## Analysis rules

Rule-based and folder-local. Scans subject and body for:
- Wordy phrases with simpler replacements
- Jargon without context
- Sentences over 30 words
- Passive voice patterns
- Missing greeting/closing
- Empty subject line
- Aggressive tone (ALL-CAPS, excessive exclamation)
- Passive-aggressive phrases

## Sanitization

safeImproveDraft normalizes text to NFC and strips ASCII control characters
and zero-width characters before analysis.

## Boundaries

Self-contained workspace. No imports from main app, routing, inbox architecture,
wallet core, Stellar core, database schema, or design system.
