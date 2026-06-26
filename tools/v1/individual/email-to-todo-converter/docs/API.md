# Email-to-Todo Converter API

## Overview

This folder exposes a small, deterministic UI surface plus pure helper
functions. The implementation stays local to the tool folder and does not depend
on the main app shell, routing, inbox, wallet, Stellar, or database layers.

## UI

### `EmailToTodoConverter`

```ts
interface EmailToTodoConverterProps {
  email: NormalizedEmail | null;
  onSaveDraft?: (draft: TaskDraft) => void;
  idPrefix?: string;
}
```

Renders the current email, a convert action, validation/error feedback, and a
reviewable task draft.

### Behavior

- Disabled when no convertible email is available.
- Announces loading, success, and error states through accessible live regions.
- Preserves review-before-save behavior; nothing is persisted automatically.

## Helpers

### `buildTaskTitle(email)`

Extracts a task title from the subject when it is actionable. If the subject is
generic, it falls back to the first actionable sentence in the body.

### `buildTaskNotes(email)`

Produces a normalized notes field from the full body text.

### `detectPriority(email)`

Returns `high` for urgent language and `normal` otherwise.

### `suggestDueDate(email, priority)`

Uses an explicit due date when one is present in the email text. Otherwise, it
falls back to a deterministic offset from `receivedAt`.

### `buildTaskDraft(email)`

Produces the full draft object, including source metadata and suggested due
date/priority.

### `hasConvertibleContent(email)`

Checks whether a selected email contains enough content to convert.

## Data Types

### `NormalizedEmail`

```ts
interface NormalizedEmail {
  id?: string;
  subject: string;
  sender: string;
  receivedAt: string;
  body: string;
  labels?: string[];
}
```

### `TaskDraft`

```ts
interface TaskDraft {
  title: string;
  notes: string;
  sourceEmailId?: string;
  sourceSubject: string;
  sourceSender: string;
  sourceReceivedAt: string;
  suggestedDueDate: string;
  suggestedPriority: "normal" | "high";
}
```

## Notes

- The draft is intentionally review-first.
- Saving is delegated to the host application through `onSaveDraft`.
- The helper functions are deterministic and suitable for unit testing.
