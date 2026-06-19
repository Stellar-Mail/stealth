# Email-to-Todo Converter Specs

## Purpose

Extract actionable todos from individual inbox emails so users can capture follow-up tasks without re-reading threads.

## Input Contract

```ts
type EmailToTodoInput = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  bodyPreview?: string;
  receivedAt?: string;
};
```

## Output Contract

```ts
type ExtractedTodo = {
  id: string;
  sourceEmailId: string;
  task: string;
  confidence: "high" | "medium" | "low";
  evidence: string;
  dueDate?: string;
  priority?: "high" | "medium" | "low";
};
```

## Open Questions

- Extraction strategy: manual selection vs automatic full-inbox parse vs LLM-assisted extraction. Architecture should not preclude any of the three.
- Storage destination: where does an ExtractedTodo persist once created? No local store, fixture-only store, or real task-store integration has been decided.
- Due date / priority inference: whether these are derived automatically or left for manual user input is undecided.

## Decision Rules

- Never send raw message content to any destination outside the user-controlled execution boundary without explicit consent.
- A todo's evidence field must quote only the minimal text needed to justify it.
- Suggestions must be deterministic for the same input fixture.
- At most five candidate todos returned per email.

## Test Fixtures

Use `fixtures/email-todo-cases.json` as the baseline fixture set for future unit tests.

## Module Boundaries

- `components/` — future folder-local UI only (e.g. todo review/approval list). No implementation yet.
- `services/` — future folder-local extraction + mapping logic (e.g. extractTodos.ts). Must not import from src/components/mail or any core app module. No implementation yet.
- `hooks/` — future folder-local React hooks wrapping services/ for local UI state. No implementation yet.
- `tests/` — fixture-backed test plan now; executable unit tests once services/ exists.
- `docs/` — architecture and review notes, folder-local only.

## Review Expectations

Until executable code exists, reviewers can validate this tool by checking that the fixtures and the test plan cover the decision rules, edge cases, and privacy boundaries without modifying the main app.
