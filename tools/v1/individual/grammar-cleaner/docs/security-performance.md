# Grammar Cleaner — Security and Performance Notes

## Threat assumptions

The Grammar Cleaner is an isolated, local-only V1 tool. It treats every value passed into the service boundary as untrusted, including pasted email bodies, copied HTML, malformed objects from future integrations, and adversarial strings intended to waste CPU.

The tool assumes:

- Input may be missing, null, non-object, or an object with non-string fields.
- Email text may contain invisible Unicode, null bytes, control characters, or bidirectional formatting marks copied from rich mail clients.
- Future integrations may accidentally pass attachment metadata, team/member lists, history arrays, or other large datasets in the same payload.
- The tool must not render or execute HTML. It only accepts plain text and returns plain text corrections.
- The service is deterministic and local; no network calls, persistence, telemetry, AI requests, or mailbox access are allowed in this folder.

## Unsafe input handling

The `safeCleanGrammar` entry point should be used by components, hooks, and future integrations. It performs a preflight before the grammar engine runs:

1. Reject unsupported payloads that do not contain a `bodyText` string.
2. Sanitize subject and body text by normalizing Unicode and removing unsafe control/invisible formatting characters.
3. Reject bodies and subjects above the folder-local limits.
4. Reject future integration payloads that include attachments, team members, message history, or thread history beyond the local caps.
5. Only then call the grammar engine.

This prevents malformed values from reaching regex-heavy grammar rules and keeps hostile large payloads from causing unnecessary work.

## Performance constraints

Current limits are intentionally conservative for an individual V1 launch tool:

| Input area   |             Limit | Reason                                                              |
| ------------ | ----------------: | ------------------------------------------------------------------- |
| Subject      |    200 characters | Avoid spending time on oversized metadata.                          |
| Body         | 50,000 characters | Keep regex passes bounded for large emails.                         |
| Body         |       8,000 words | Avoid pathological whitespace-heavy or token-heavy messages.        |
| Attachments  |        0 accepted | This tool does not inspect attachments.                             |
| Team members |        1 accepted | Individual tier only; team datasets are out of scope.               |
| Histories    |        0 accepted | Thread/message history processing needs a future integration issue. |

Large email threads should be trimmed by the caller to the message body the user is actively editing. Attachments, prior replies, quoted threads, and team member lists should be summarized elsewhere or handled by a future batch-processing feature rather than passed to this tool.

## Follow-up integration guidance

A future integration issue should keep the same preflight behavior at the boundary between the mail app and this folder. If the tool needs attachment awareness, team workflows, or history-aware suggestions, add new folder-local tests and explicit limits before connecting those datasets.
