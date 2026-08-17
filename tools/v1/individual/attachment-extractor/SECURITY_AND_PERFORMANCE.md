# Attachment Extractor Security and Performance Notes

## Threat assumptions

The V1 individual Attachment Extractor treats every raw email payload, MIME header, filename, content type, and `File` object as untrusted. Attackers may provide malformed multipart boundaries, deeply nested or oversized messages, path traversal filenames, control characters, unsupported MIME types, many small files, or unusually large attachments intended to exhaust CPU or memory.

This folder is intentionally isolated from the main app. Future integration must pass already-authorized message data into this tool rather than letting the tool read inbox state, authentication state, wallet state, database records, or mail rendering internals directly.

## Unsafe inputs handled locally

- Raw email payloads are rejected before parsing when they exceed the safe payload budget.
- Multipart boundaries are accepted only when they are short and match a conservative MIME boundary character set.
- Multipart part counts are capped so hostile messages cannot force unbounded scanning.
- Attachment filenames are reduced to their final path segment, stripped of control characters, normalized to a safe character set, and truncated.
- Attachment bodies above the configured per-attachment ceiling are skipped with a warning.
- Browser `File` batches are capped by file count and aggregate byte size before expensive metadata or checksum work begins.
- File sizes, names, and MIME types are normalized before validation and before they are exposed as attachment metadata.

## Performance constraints

- The raw MIME extractor performs bounded metadata extraction only; it does not decode full binary payloads or recursively inspect archives.
- Checksum generation remains opt-in because it reads entire files into memory.
- Image metadata extraction remains opt-in through `extractMetadata` and should be disabled for very large batches.
- The default batch limits are 100 files and 250 MB aggregate input for individual use. Team-scale mailboxes, long histories, or bulk exports should use a paginated backend job in a future integration issue.

## Follow-up integration notes

Do not connect this tool to application routing, inbox state, mail rendering, wallet code, auth code, database schema, or Stellar integration without a separate integration issue and review. Any future integration should preserve these folder-local guards and add caller-side pagination.
