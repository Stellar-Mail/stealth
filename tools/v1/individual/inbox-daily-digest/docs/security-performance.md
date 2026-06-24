# Inbox Daily Digest security and performance notes

This tool is still isolated from the mail app. The guard helpers in `services/digestGuards.ts`
define the input contract expected by future integration work.

## Threat assumptions

- Mail content is untrusted, even when it came from a user's own mailbox.
- Sender names, subjects, labels, attachment names, and bodies may contain markup, control
  characters, extremely long text, duplicated values, or unexpected non-string values.
- The tool must not fetch remote content, render raw HTML, execute mailbox-provided scripts, or
  mutate messages while building a digest.
- Attachments are represented only by sanitized names in this isolated tool. File bytes are out of
  scope until a future integration issue explicitly permits them.

## Unsafe input handling

`guardDigestEmails` accepts `unknown` input and returns a typed result. It never throws for malformed
mailbox snapshots.

The guard layer:

- rejects non-array snapshots;
- rejects email entries that are not objects;
- requires sanitized `sender`, `subject`, and `body` fields;
- strips HTML tags and ASCII control characters;
- normalizes repeated whitespace;
- caps body length, field length, label count, attachment count, and email count;
- reports accepted, rejected, and truncated counts for review.

## Performance limits

Defaults are intentionally small for a daily preview:

- `maxEmails`: 50
- `maxBodyCharacters`: 8,000
- `maxTextFieldCharacters`: 180
- `maxLabels`: 12
- `maxAttachments`: 10

Future integration work should preserve these caps or justify higher limits with local benchmark
data. Digest generation should process the capped snapshot once, avoid repeated full-body scans,
and avoid loading attachment bytes.

## Review checklist

- Pass hostile fixtures as `unknown` and verify the function returns warnings instead of throwing.
- Confirm rejected records do not appear in the returned email list.
- Confirm long bodies and long lists are truncated before any summarization or rendering layer sees
  them.
- Confirm no security-sensitive application code outside this folder is modified.
