# Security and Performance

## Threat Assumptions

The Draft Improver operates on user-supplied text in a self-contained, isolated
workspace. It does not send data over a network, persist drafts to a database,
or share content with external services. The following threat model assumes a
hostile or malformed sender provides a raw `DraftInput` object through a future
consumer component.

### Unsafe Inputs

| Input Vector                                                  | Risk                                                                                 | Mitigation                                                                                                                                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Subject or body exceeding size limits**                     | Memory exhaustion or denial-of-service from large text payloads                      | `validateDraftInput()` rejects inputs exceeding `maxInputSizeBytes` (default 200 KB). `sanitizeDraft()` truncates subject to 100 chars and body to 100,000 chars by default.           |
| **Null, undefined, or non-object input**                      | Runtime crashes in consumer code                                                     | `validateDraftInput()` returns `{ valid: false, error }` for null, undefined, arrays, and non-object types.                                                                            |
| **Missing or non-string required fields**                     | Type coercion errors or unexpected behaviour                                         | Each field (`id`, `subject`, `body`) is type-checked. Non-string values produce a validation error.                                                                                    |
| **Control characters in text**                                | Display rendering issues or injection in HTML contexts                               | `sanitizeDraft()` strips ASCII control characters (`\x00-\x08`, `\x0B`, `\x0C`, `\x0E-\x1F`) from both subject and body.                                                               |
| **Extremely long words or sentences**                         | Performance degradation in regex matching                                            | Sentence length is capped at 40 words before triggering a clarity warning. The spell checker uses a fixed dictionary of ~20 entries and is `O(n)` over word boundaries.                |
| **Sensitive or secret content (API keys, passwords, tokens)** | Accidental credential exposure if the draft is sent                                  | `detectSensitiveContent()` checks against a blocklist of regex patterns and flags them as errors. This check can be disabled via `enableSensitiveContentCheck: false`.                 |
| **Personal data flag mismatch**                               | Privacy violation if `containsPersonalData` is false but the draft contains real PII | The `containsPersonalData` field is a self-reported flag. When true and sensitive checks are disabled, `analyzeDraft()` returns an error rather than silently processing.              |
| **Repeated analysis of the same large draft**                 | Unnecessary CPU cycles                                                               | The service is stateless and synchronous. Consumers should memoize or cache results. The component wrapper (`DraftImproverTool`) uses `useMemo` to avoid re-analysis on stable inputs. |

### Data Handling

- All inputs are treated as untrusted until validated.
- The service does not write to disk, make network requests, or import any
  external data source.
- Synthetic fixtures in `fixtures/` use only `example.test` domains and contain
  no real personal data, credentials, or mailbox information.

## Performance Notes

### Large Emails

- Maximum input size is 200 KB by default. Larger inputs are rejected before
  any processing begins.
- Subject is truncated to 100 characters, body to 100,000 characters before
  analysis. This limits the working set for regex operations.
- The spell checker iterates word-boundary tokens against a fixed dictionary
  and is linear in the length of the text.

### Large Attachments

- Attachment detection is limited to keyword matching in the body text
  (`"attached"`, `"see attach"`, `"attachment"`). The tool does not parse,
  decode, or analyse attachment content.
- Future attachment-aware improvements should enforce file-size limits before
  any content extraction.

### Teams / High Volume

- The analysis engine is synchronous and runs in a single call frame. For bulk
  analysis of many drafts, the consumer should batch calls and manage concurrency.
- The `DraftImproverTool` component uses `useMemo` so re-renders with the same
  draft input do not re-run the analysis.
- There is no shared state, global cache, or side-effect in the service layer.
  Each call is fully isolated.

### History / Audit

- The tool does not maintain an analysis history or audit log. Consumers
  wishing to track changes over time should store results externally and pass
  them back as the `results` prop to skip re-computation.
- No local storage, session storage, or IndexedDB is used by the service layer.
