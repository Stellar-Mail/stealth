# Customer Support Macro Tool - Security and Performance Notes

This document records the local security assumptions, unsafe input handling,
and performance limits for the isolated Customer Support Macro Tool.

## Scope

All guidance applies only to:

```text
tools/v1/team/customer-support-macro-tool/
```

The tool does not read a live inbox, insert into compose windows, send mail,
call providers, call AI services, write server records, notify users, touch
wallet or Stellar state, or connect to the app shell. Future integration must
add an explicit adapter issue before using real customer or mailbox data.

## Threat Assumptions

- Macro titles, bodies, tags, variables, stored macro records, import/export
  payloads, attachment metadata, and history windows are untrusted input.
- Macro output is suggested text only; this folder must not send, save, or
  insert it into compose automatically.
- Attachment contents are out of scope for this folder; only bounded metadata
  may be accepted by guard helpers.
- Large macro libraries, team histories, and import/export batches can create
  avoidable CPU and memory work even when each record is valid.
- Fixtures must remain synthetic and must not contain real customer replies,
  tickets, order ids, secrets, API keys, access tokens, wallet data, or provider
  credentials.

## Guard Helpers

`guards/macro-guards.mjs` owns folder-local validation and sanitization:

- `sanitizeMacroText()` removes HTML-like tags, control characters, zero-width
  characters, leading/trailing whitespace, and oversized text.
- `validateMacroId()` rejects empty ids, path traversal, whitespace, and
  unsupported characters.
- `validateMacroCategory()` allowlists the six local macro categories.
- `validateTags()` bounds tag counts, strips unsafe text, and normalizes tags.
- `sanitizeMacroInput()` validates create/update-shaped macro input.
- `validateVariableMap()` validates interpolation variables before rendering a
  macro preview.
- `sanitizeStoredMacro()` validates stored macro records before import or
  storage hydration.
- `guardMacroBatch()` caps the number of macros processed in one pass.
- `guardSearchOptions()` bounds search and filter input.
- `guardAttachmentMetadata()` accepts metadata only and rejects embedded file
  contents.
- `guardHistoryWindow()` caps future audit/history scans.

These guards are pure and synchronous. They do not perform network calls,
storage writes, mailbox reads, compose writes, notification delivery, provider
calls, AI calls, or background jobs.

## Unsafe Inputs

| Input                             | Risk                                   | Handling                              |
| --------------------------------- | -------------------------------------- | ------------------------------------- |
| Path-like macro ids               | Path traversal or confusing audit ids  | Rejected by `validateMacroId()`       |
| HTML-like text in title/body/tags | Accidental markup or script display    | Stripped before use                   |
| Control or zero-width characters  | Hidden content or rendering surprises  | Removed by `sanitizeMacroText()`      |
| Unsupported categories            | Undefined behavior or broken filters   | Rejected by `validateMacroCategory()` |
| Oversized variable maps           | Excess interpolation work              | Rejected by `validateVariableMap()`   |
| Oversized macro libraries         | Slow full-library scans                | Rejected with a pagination hint       |
| Attachment contents               | File parsing, malware, memory pressure | Rejected; metadata only               |
| Oversized histories               | Avoidable scan cost                    | Rejected with a smaller-window hint   |

## Performance Limits

The current guard constants are intentionally conservative:

| Limit                    | Value                           |
| ------------------------ | ------------------------------- |
| Macro batch size         | 500 macros                      |
| Title length             | 120 characters                  |
| Body length              | 4,000 characters                |
| Tag count                | 20 tags                         |
| Variable count           | 50 variables                    |
| Variable value length    | 1,000 characters                |
| Search query length      | 120 characters                  |
| Attachment count         | 25 metadata rows                |
| Attachment size metadata | 10,000,000 bytes per attachment |
| History events           | 500 rows                        |

Future integrations should paginate large macro libraries, import files, team
histories, and attachment lists before calling search, interpolation, or export
logic. The tool should operate on a bounded, user-confirmed slice rather than
scanning full organizations or long-running support histories.

## Review Commands

Run from the repository root:

```bash
node --test tools/v1/team/customer-support-macro-tool/tests/macro-guards.test.mjs
```

The guard test uses `fixtures/hostile-macro-inputs.json` to verify malformed
input rejection, text sanitization, variable-map boundaries, attachment
metadata boundaries, and oversized collection guards.

## Future Adapter Checklist

- Normalize real support data into folder-local macro shapes.
- Run guard helpers before create, update, import, export, search, and
  interpolation paths.
- Keep compose insertion and send behavior behind explicit user confirmation.
- Avoid logging raw macro bodies, customer names, ticket ids, or order ids.
- Paginate large macro libraries, histories, and attachment metadata.
- Keep provider, AI, database, notification, wallet, and Stellar integrations
  outside this folder unless a future issue explicitly allows them.
