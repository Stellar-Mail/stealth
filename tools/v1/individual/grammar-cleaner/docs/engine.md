# Grammar Cleaner Engine

## Overview

The Grammar Cleaner engine is a pure, deterministic, rule-based system that
checks text for common grammar, spelling, punctuation, capitalization, and
redundancy issues. No network calls, no external AI providers, and no mailbox
mutations: every correction is derived locally from the input text.

## Architecture

```
Input (GrammarInput)
  │
  ▼
Guards (sanitize, check limits)
  │
  ▼
cleanGrammar()
  ├── Homophone rules (spelling)
  ├── Capitalization rules (I → I)
  ├── Sentence-start capitalization
  ├── Punctuation rules
  └── Redundancy rules (filler words)
  │
  ▼
Output (GrammarResultStatus)
```

## Rule Categories

### Spelling (Homophones & Common Misspellings)

- their/there/they're, your/you're, its/it's, effect/affect
- Common typos: teh, recieve, acheive, definately, occurence, seperate,
  calender, tommorow, begining, embarass, accomodate, wich, thier, alot

### Grammar

- "could of" → "could have", "should of" → "should have",
  "would of" → "would have", "might of" → "might have"
- "less people" → "fewer people" (for countable nouns)

### Capitalization

- Lowercase "i" → uppercase "I"
- First letter of each sentence after `.`, `!`, or `?`

### Punctuation

- Double/multiple spaces → single space
- Space before comma, period, question mark, exclamation mark → removed
- Multiple periods → single period

### Redundancy

- Filler words removed: just, really, very, basically, actually

## Guard Layer

Before the engine runs, the guard layer (guards.ts):

- Strips control characters and invisible/zero-width characters (sanitize)
- Enforces hard input limits:
  - Subject: max 200 characters
  - Body: max 50,000 characters
  - Body: max 8,000 words
- Provides safeCleanGrammar() as the hardened entry point

## State Machine

```
         ┌─────────────────────────────────────┐
         │                                     │
         ▼                                     │
    ┌─────────┐   submit   ┌──────────┐        │
    │  idle   │ ──────────►│ loading  │        │
    └─────────┘            └────┬─────┘        │
         ▲                      │              │
         │         ┌────────────┼────────┐     │
         │         ▼            ▼        │     │
         │   ┌─────────┐  ┌─────────┐    │     │
         │   │  error  │  │  ready  │    │     │
         │   └─────────┘  └─────────┘    │     │
         │         │            │        │     │
         └─────────┴────────────┴────────┘     │
         (reset / retry)              (check another)
                                              │
                                              └─────────┘
```

## Determinism

The engine is stateless and deterministic: the same input always produces the
same output. This makes it safe to use in tests, previews, and comparison views.
