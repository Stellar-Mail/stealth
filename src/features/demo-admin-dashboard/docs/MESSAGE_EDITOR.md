# MessageEditor

A controlled form component for editing a single demo message draft. Provides
editable inputs for subject, recipients, and body, with live validation feedback
and a preview section.

All logic and UI live inside `src/features/demo-admin-dashboard/` and operate on
deterministic demo data (`Draft`). Nothing here touches real mail flows, network
calls, or data outside this folder.

## Props

| Prop          | Type                     | Default   | Description                             |
| ------------- | ------------------------ | --------- | --------------------------------------- |
| `draft`       | `Draft`                  | required  | The draft being edited (controlled).    |
| `onChange`    | `(draft: Draft) => void` | required  | Called whenever a field value changes.  |
| `onSave`      | `() => void`             | undefined | Called when the user clicks Save.       |
| `onCancel`    | `() => void`             | undefined | Called when the user clicks Cancel.     |
| `showPreview` | `boolean`                | `true`    | Whether to render the preview section.  |
| `className`   | `string`                 | undefined | Extra CSS classes for the root element. |

When switching between different drafts, the parent should use a React `key`
prop on `<MessageEditor>` to reset internal state (e.g., the recipients text
input):

```tsx
<MessageEditor key={draft.id} draft={draft} onChange={...} />
```

## Validation behavior

Validation reuses `validateCampaignDrafts` from `validation.ts` via the
`validateMessage` wrapper which strips the `drafts[0].` prefix from field paths.

### Rules enforced

| Field      | Rule                               | Severity |
| ---------- | ---------------------------------- | -------- |
| subject    | Must be non-empty                  | error    |
| body       | Must be non-empty                  | error    |
| recipients | Must have at least one entry       | error    |
| recipients | Each entry must contain `@` or `*` | error    |
| recipients | Domain must be a safe demo domain  | warning  |

### How it displays

- **Field-level:** invalid fields show a red border and an inline error message
  below the input (only the first error per field).
- **Summary:** a `ValidationResultsPanel` below the form fields displays all
  issues grouped by severity.

## Preview behavior

The preview section follows the same styling as the
[TemplatePicker](../templates/TemplatePicker.tsx) detail panel:

- Subject line and recipients rendered as a `<dl>` grid
- Body rendered in a `<pre>` block with the same dark border, `bg-black/30`
  background, and monospace-friendly font stack

## Example usage

```tsx
import { useState } from "react";
import { MessageEditor } from "./components/MessageEditor";
import type { Draft } from "../types/draft";

function MyEditor() {
  const [draft, setDraft] = useState<Draft>({
    id: "draft-edit-1",
    subject: "",
    body: "",
    recipients: [],
  });

  const handleSave = () => {
    console.log("Saving draft:", draft);
  };

  return <MessageEditor key={draft.id} draft={draft} onChange={setDraft} onSave={handleSave} />;
}
```

### Integration with `draftReducer`

```tsx
import { useReducer } from "react";
import { draftReducer, initialState } from "../reducers/draftReducer";
import { MessageEditor } from "./components/MessageEditor";

function ReducerEditor() {
  const [state, dispatch] = useReducer(draftReducer, initialState);

  return (
    <MessageEditor
      key={state.current?.id}
      draft={state.current ?? { id: "", subject: "", body: "", recipients: [] }}
      onChange={(draft) => dispatch({ type: "editDraft", payload: draft })}
      onSave={() => console.log("Saved:", state.current)}
    />
  );
}
```

## Exported helpers

These pure functions are exported from `components/MessageEditor.tsx` and tested
independently:

- `validateMessage(draft: Draft): ValidationIssue[]` — validates a single draft.
- `parseRecipientsInput(input: string): string[]` — splits on comma, trims,
  filters empties.
- `formatRecipientsDisplay(recipients: string[]): string` — joins with `", "`.
- `formatMessagePreview(draft: Draft): string` — formats a plain-text preview.

## Future integration notes

- The component is intentionally kept controlled so it can be wired into a
  campaign snapshot editor, the template picker flow, or a standalone draft
  creation form without modification.
- To support multi-draft editing, wrap each `MessageEditor` in a list with
  unique keys and manage the draft array in the parent.
