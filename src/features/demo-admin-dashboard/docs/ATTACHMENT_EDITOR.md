# AttachmentEditor

Admin control for adding and editing demo attachments within the Demo Admin Dashboard.

## Purpose

`AttachmentEditor` is a focused React form component that lets maintainers add new demo
attachment records or edit existing ones. All data it produces is fake, deterministic, and
safe for public repository review.

## Location

```
src/features/demo-admin-dashboard/
  components/AttachmentEditor.tsx   ← main component
  types/attachment.ts               ← DemoAttachmentRecord, AttachmentDraft, …
  helpers/attachmentHelpers.ts      ← validation, formatting, filtering helpers
  fixtures/attachmentFixtures.ts    ← 7 canonical demo records + blankAttachmentDraft
  __tests__/attachmentHelpers.test.ts ← full helper/fixture test suite
```

## Component API

```tsx
import { AttachmentEditor } from "@/features/demo-admin-dashboard/components/AttachmentEditor";

// Add mode
<AttachmentEditor
  onSave={(draft, id) => console.log(id, draft)}
  onCancel={() => setOpen(false)}
/>

// Edit mode — pass an existing DemoAttachmentRecord
<AttachmentEditor
  record={existingRecord}
  onSave={(draft, id) => updateRecord(id, draft)}
  onCancel={() => setEditing(null)}
/>
```

### Props

| Prop        | Type                                           | Required | Notes                                         |
| ----------- | ---------------------------------------------- | -------- | --------------------------------------------- |
| `record`    | `DemoAttachmentRecord`                         | no       | When provided, editor is in "edit" mode.      |
| `onSave`    | `(draft: AttachmentDraft, id: string) => void` | yes      | Called only when the draft passes validation. |
| `onCancel`  | `() => void`                                   | no       | Renders a Cancel button when provided.        |
| `className` | `string`                                       | no       | Extra CSS class on the root element.          |

## Metadata Fields

| Field            | Required | Description                                                                                                   |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `fileName`       | ✓        | File name including extension (e.g. `invoice_1042.pdf`).                                                      |
| `category`       | ✓        | One of `document`, `image`, `data`, `proof`, `transaction`, `archive`, `other`. Auto-inferred from extension. |
| `fileType`       | ✓        | Human-readable label shown in the UI (e.g. `PDF Document`).                                                   |
| `fileSizeBytes`  | ✓        | Exact byte count for sorting/filtering. Auto-fills `fileSize`.                                                |
| `fileSize`       | ✓        | Display string (e.g. `120 KB`). Auto-derived from bytes.                                                      |
| `messageSubject` | ✓        | Subject of the parent demo message.                                                                           |
| `sender`         | ✓        | Must use `@example.com`, `@example.org`, or `*stealth.demo`.                                                  |
| `receivedAt`     | ✓        | ISO 8601 local timestamp — fixed, not `Date.now()`.                                                           |
| `description`    |          | One-sentence description for the detail panel.                                                                |
| `previewUrl`     |          | Relative path or `#anchor` only — no live URLs.                                                               |

## Validation Rules

Validation runs live on every keystroke via `validateAttachmentDraft` from
`helpers/attachmentHelpers.ts`. Errors are shown inline beneath each field.

| Field            | Rule                                                                    |
| ---------------- | ----------------------------------------------------------------------- |
| `fileName`       | Non-empty; must include `.` (extension required).                       |
| `fileSize`       | Matches `/^\d+(\.\d+)?\s*(B\|KB\|MB\|GB)$/i`.                           |
| `fileSizeBytes`  | Non-negative integer.                                                   |
| `fileType`       | Non-empty string.                                                       |
| `category`       | One of the 7 allowed `AttachmentCategory` values.                       |
| `messageSubject` | Non-empty string.                                                       |
| `sender`         | Passes `isSafeSenderAddress` — only safe demo domains accepted.         |
| `receivedAt`     | ISO 8601 local timestamp (`yyyy-MM-ddTHH:mm` or `yyyy-MM-ddTHH:mm:ss`). |
| `previewUrl`     | If provided, must not start with `http://` or `https://`.               |

## Keyboard Shortcut

`Ctrl+Enter` / `⌘+Enter` while focus is inside the form triggers Save (when valid).

## ID Generation (Add Mode)

In add mode the component derives a slug-style `id` from `fileName`:

```
"Invoice 1042.pdf"  →  "att-invoice-1042"
"secure_payload.zip"→  "att-secure-payload"
```

The caller receives the generated `id` as the second argument to `onSave`.

## Security Notes

- All demo data must remain fake and deterministic — no real user data or live URLs.
- Sender address validation (`isSafeSenderAddress`) is enforced before Save is enabled.
- `previewUrl` rejects `http://` and `https://` origins to prevent accidentally referencing
  live resources in demo fixtures.
- The component uses React JSX framework-native escaping exclusively; no
  `dangerouslySetInnerHTML` is used anywhere.
- No authentication tokens, secrets, or PII are handled by this component.

## Integration Note (Follow-up)

To surface `AttachmentEditor` inside the main `DemoAdminDashboard` shell, add an
"Attachments" panel that renders this component in a modal or inline slot. This wiring is
intentionally deferred to keep the current issue scoped and independently reviewable.

<!-- TODO(security): CSRF tokens would be required if this editor were wired to a real
backend endpoint. Currently all state is in-memory demo data only. -->
