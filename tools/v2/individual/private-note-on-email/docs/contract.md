# Non-UI Execution Contract: Private Note on Email

## Service Boundaries

| Entry point                                                | Intended caller                           | Behavior                                                |
| ---------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| `safeAttachPrivateNote(input: unknown, options?: unknown)` | API handlers, webhooks, untrusted callers | Validates, sanitizes, enforces limits, and never throws |
| `attachPrivateNote(input, options?)`                       | Trusted internal code                     | Pure deterministic service; assumes valid input shape   |

The module is synchronous and has no UI, CSS, DOM, framework, database, network, wallet, or Stellar core dependencies.

## Input & Output Contract

### `PrivateNoteAttachmentInput`

- `requestId`: `string` (caller-owned unique identifier)
- `emailId`: `string` (target email identifier)
- `emailSubject`?: `string` (optional email subject)
- `emailSender`?: `string` (optional sender address)
- `noteText`: `string` (body of the private note)
- `importance`?: `"low" | "medium" | "high" | "urgent"` (default: `"medium"`)
- `visibility`?: `"private" | "shared_with_team" | "confidential"` (default: `"private"`)
- `tags`?: `string[]` (optional array of metadata tags)
- `reminderAt`?: `string` (optional ISO 8601 reminder timestamp)

### `PrivateNoteAttachmentOptions`

- `maxNoteLength`?: `number` (max character length, default: 4000, max: 20000)
- `maxTags`?: `number` (max tags count, default: 10, max: 50)
- `autoTagKeywords`?: `boolean` (auto-extract key tags from note text, default: `true`)
- `stripHtml`?: `boolean` (sanitize and strip HTML tags, default: `true`)

### `PrivateNoteAttachmentOutput`

- `requestId`: `string`
- `emailId`: `string`
- `noteId`: `string` (deterministic ID: `note_<emailId>_<hash>`)
- `cleanNoteText`: `string` (sanitized plain-text note)
- `importance`: `PrivateNoteImportance`
- `visibility`: `PrivateNoteVisibility`
- `tags`: `string[]` (lowercased, deduplicated tags)
- `characterCount`: `number`
- `wordCount`: `number`
- `createdAt`: `string` (ISO 8601 timestamp)
- `reminderAt`: `string | null`
- `metadata`: `{ emailSubjectSnippet: string | null; emailSender: string | null; autoTagged: boolean }`

The guarded entry point returns:

```ts
{ status: "ok", result: PrivateNoteAttachmentOutput }
```

Or on error:

```ts
{
  status: "error";
  code: PrivateNoteErrorCode;
  message: string;
  issues: PrivateNoteValidationIssue[];
}
```

## Error Codes

| Code              | Meaning                                                   |
| ----------------- | --------------------------------------------------------- |
| `invalid-input`   | Payload shape or field type is invalid                    |
| `invalid-options` | Options are malformed or outside supported bounds         |
| `note-too-long`   | `noteText` exceeds max character length limit             |
| `too-many-tags`   | `tags` count exceeds maximum allowed tags limit           |
| `empty-note`      | `noteText` is empty or whitespace-only after sanitization |

## Fixtures

`services/fixtures.ts` exports typed `successFixtures` and `failureFixtures`.
Every failure fixture specifies its expected error code, making the contract reusable across backend adapters and test runners.
