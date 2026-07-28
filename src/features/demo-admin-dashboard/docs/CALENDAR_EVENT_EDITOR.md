# CalendarEventEditor

A controlled form component for editing calendar invite cards attached to demo messages. Provides editable inputs for event title, start/end date-time, location, attendees, and response state, with live validation feedback.

All logic and UI live inside `src/features/demo-admin-dashboard/` and operate on deterministic demo data. Nothing here touches real mail flows, network calls, or data outside this folder.

## Props

| Prop        | Type                                        | Default   | Description                             |
| ----------- | ------------------------------------------- | --------- | --------------------------------------- |
| `state`     | `CalendarEventEditorState`                  | required  | The event being edited (controlled).    |
| `onChange`  | `(state: CalendarEventEditorState) => void` | required  | Called whenever a field value changes.  |
| `onSave`    | `() => void`                                | undefined | Called when the user clicks Save.       |
| `onCancel`  | `() => void`                                | undefined | Called when the user clicks Cancel.     |
| `className` | `string`                                    | undefined | Extra CSS classes for the root element. |

When switching between different events, the parent should use a React `key` prop on `<CalendarEventEditor>` to reset internal state:

```tsx
<CalendarEventEditor key={event.id} state={event} onChange={...} />
```

## Validation behavior

Validation uses `validateCalendarEventEditor` from `calendarEventValidation.ts`.

### Rules enforced

| Field     | Rule                                      | Severity |
| --------- | ----------------------------------------- | -------- |
| title     | Must be non-empty                         | error    |
| startTime | Must be non-empty and parseable as a date | error    |
| endTime   | Must be non-empty and parseable as a date | error    |
| endTime   | Must be later than startTime              | error    |
| attendees | Each entry must contain `@` or `*`        | error    |
| attendees | Domain must be a safe demo domain         | warning  |

### How it displays

- **Field-level:** invalid fields show a red border and an inline error message below the input (only the first error per field).
- **Summary:** a `ValidationResultsPanel` below the form fields displays all issues grouped by severity.

## Response State

The `responseState` field represents the recipient's RSVP status. Options:

| Value         | Label        | Description                                        |
| ------------- | ------------ | -------------------------------------------------- |
| `needsAction` | Needs action | The recipient has not yet responded.               |
| `accepted`    | Accepted     | The recipient accepted the invitation.             |
| `declined`    | Declined     | The recipient declined the invitation.             |
| `tentative`   | Tentative    | The recipient tentatively accepted the invitation. |

## Exported helpers

These pure functions are exported from `components/CalendarEventEditor.tsx`:

- `prepareAttendees(input: string): string[]` — splits on comma, trims, filters empties.
- `formatAttendeesDisplay(attendees: string[]): string` — joins with `", "`.

## Types

- `CalendarEventEditorState` — the controlled editor state shape.
- `CalendarResponseState` — the RSVP response state union type.
- `calendarEventToEditorState(event)` — converts a `DemoCalendarEvent` to editor state.
- `editorStateToCalendarEvent(state)` — converts editor state back to `DemoCalendarEvent`.

## Converting from / to DemoCalendarEvent

```ts
import { calendarEventToEditorState, editorStateToCalendarEvent } from "../types/calendarEvent";
import type { DemoCalendarEvent } from "../types/dataset";

const event: DemoCalendarEvent = {/* ... */};
const editorState = calendarEventToEditorState(event);
// ... edit fields ...
const updated: DemoCalendarEvent = editorStateToCalendarEvent(editorState);
```

## Fixtures

```ts
import { calendarEventFixtures, defaultCalendarEvent } from "../fixtures/calendarEventFixtures";
```

`calendarEventFixtures` provides five deterministic demo events. `defaultCalendarEvent` is a blank starter.
