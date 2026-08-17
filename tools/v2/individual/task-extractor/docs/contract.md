# Task Extractor — Execution Contract

Stable backend-facing contract for extracting action items from a message
independently of any presentation layer. All types live in
`types/taskExtractor.ts` and are re-exported from the folder root `index.ts`.

## Entry points

| Export                                                                                            | Kind                        | Use when                                                                                |
| ------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| `safeExtractTasks(input: unknown, options?: unknown): SafeTaskExtractionResult`                   | Guarded service entry point | Caller input is untrusted (API handlers, queue consumers). Never throws.                |
| `extractTasks(input: TaskExtractionInput, options?: TaskExtractionOptions): TaskExtractionResult` | Pure engine                 | Input is already validated and sanitized (e.g. replaying fixtures, internal pipelines). |

Both functions are pure and deterministic: no network calls, no mailbox access,
no randomness, no clock reads, and no mutation of caller-supplied objects.
Identical input always produces an identical result. Relative due phrases
("today", "tomorrow", "eod") only resolve to dates when the caller supplies
`receivedAt` — the engine never reads the system clock.

## Input

```ts
interface TaskExtractionInput {
  messageId: string; // required, non-empty; echoed back and used in task ids
  subject: string; // may be empty when body is not
  body: string; // plain text; may be empty when subject is not
  senderAddress?: string; // correlation only — never analyzed
  receivedAt?: string; // ISO 8601; enables relative due-date resolution
  language?: string; // BCP 47; only "en" / "en-*" supported
}

interface TaskExtractionOptions {
  maxTasks?: number; // 1–50, default 10
  minConfidence?: "low" | "medium" | "high"; // default "low" (keep all)
}
```

## Output

```ts
interface TaskExtractionResult {
  messageId: string;
  tasks: ExtractedTask[]; // order of appearance, truncated to maxTasks
  stats: TaskExtractionStats; // lineCount, candidateCount, extractedCount, truncated
}

interface ExtractedTask {
  id: string; // deterministic: `<messageId>-task-<n>`
  text: string; // trimmed, whitespace-collapsed, ≤ 200 chars
  source: "subject" | "body";
  trigger: "checkbox" | "request-phrase" | "bullet-action" | "imperative-line";
  priority: "low" | "normal" | "high";
  confidence: "low" | "medium" | "high";
  dueAtHint?: string; // YYYY-MM-DD when resolvable
  dueTextHint?: string; // raw phrase (e.g. "friday") when not resolvable
}
```

An empty `tasks` array is a valid success outcome, not an error.

The guarded entry point wraps this in a discriminated union:

```ts
type SafeTaskExtractionResult =
  | { status: "ok"; result: TaskExtractionResult }
  | {
      status: "error";
      code: TaskExtractionErrorCode;
      message: string;
      issues: TaskExtractionIssue[];
    };
```

## Error codes

| Code                   | Trigger                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invalid-input`        | Payload is not an object, `messageId` missing or blank, `subject`/`body` not strings, `receivedAt` unparseable, or optional fields have wrong types. |
| `invalid-options`      | `maxTasks` outside 1–50, or `minConfidence` not low/medium/high.                                                                                     |
| `input-too-large`      | `messageId` > 256 chars, `subject` > 500 chars, `body` > 50,000 chars or > 10,000 words (limits in `GUARD_LIMITS`).                                  |
| `empty-content`        | Subject and body are both empty after sanitization.                                                                                                  |
| `unsupported-language` | `language` is set and is not `en` or an `en-*` regional tag.                                                                                         |

## Extraction rules

Rule-based and folder-local; scanned per line, in order of appearance:

| Trigger           | Matches                                                                                                                         | Confidence |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `checkbox`        | `- [ ] <task>` style items                                                                                                      | high       |
| `request-phrase`  | "please …", "can/could/would you …", "make sure to …", "remember / don't forget to …", "action required: …", "we/you need to …" | high       |
| `bullet-action`   | Bullet or numbered item starting with an action verb (`ACTION_VERBS`)                                                           | medium     |
| `imperative-line` | A whole line starting with an action verb                                                                                       | low        |

- **Priority**: "urgent", "asap", "critical", "high priority", … → `high`;
  "no rush", "when you get a chance", … → `low`; otherwise `normal`.
- **Due hints**: explicit `YYYY-MM-DD` dates (validated as real calendar days)
  become `dueAtHint`. "today"/"eod" and "tomorrow" resolve against
  `receivedAt` when present; weekdays and other phrases stay as `dueTextHint`.
- **Dedup**: repeated task texts (case-insensitive) collapse to the first hit.
- **Truncation**: extraction stops at `maxTasks`; `stats.truncated` reports it.

## Sanitization

`safeExtractTasks` normalizes text to NFC and strips ASCII control characters
and zero-width characters (U+200B–U+200D, U+2060, U+FEFF) before extraction,
so hidden characters cannot mask request phrases.

## Fixtures

`services/fixtures.ts` exports:

- `successFixtures` — explicit requests, checkbox/bullet lists, urgent
  requests with relative due dates, and a no-tasks case with their expected
  task texts.
- `failureFixtures` — one payload per error path with its expected error code.

Tests in `tests/` replay both sets through the public entry points.

## Boundaries

This tool is a self-contained workspace. It has no imports from the main app,
routing, inbox architecture, wallet core, Stellar core, database schema, or
design system, and exports no UI. Run its tests from the repository root with:

```sh
npx vitest run --config tools/v2/individual/task-extractor/vitest.config.ts
```
