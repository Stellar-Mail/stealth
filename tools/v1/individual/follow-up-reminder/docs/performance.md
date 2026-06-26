# Follow-up Reminder — Performance Notes

Performance expectations and safeguards for the isolated Follow-up Reminder
tool. Scope is this folder only.

## Cost model

For an email of n characters (subject + body):

- Guard sanitization (sanitizeText): linear, a fixed set of regex passes.
- Guard validation (validateInput, checkInputLimits): linear in input size.
- Text bounding (boundedText): linear; collapses to the first MAX_SCAN_LENGTH
  (4000) characters before the engine scans for signals.
- Signal detection (explicit terms, low-confidence terms, absolute dates,
  relative dates): linear in bounded text length; each pass is a fixed set of
  term lookups or regex matches.
- Confidence and state assignment: O(1), a small set of boolean checks.
- Duplicate detection (isReminderDuplicate): linear in existingReminders length
  per call.

All scanning passes operate on a capped text window (4000 chars), so the
dominant cost is bound regardless of the original email size. There are no
nested scans over the full body.

## Hard limits

Defined in services/guards.ts as GUARD_LIMITS:

| Limit                | Default | Purpose                        |
| -------------------- | ------- | ------------------------------ |
| maxSubjectChars      | 500     | Reject runaway subject lines   |
| maxBodyChars         | 50000   | Bound total memory per scan    |
| maxBodyWords         | 10000   | Bound word-level signal passes |
| maxExistingReminders | 1000    | Bound dedup iteration per call |

Inputs above these caps are rejected by safeBuildFollowUpReminder before the
engine does any scanning work, so a hostile or accidental large payload cannot
consume meaningful CPU.

Additionally, the engine's internal MAX_SCAN_LENGTH (4000) ensures that the
text signals pass is bounded even for inputs within the guard limits.

## Large emails, attachments, teams, and histories

- **Large emails**: body is capped by maxBodyChars (50000) and maxBodyWords
  (10000); the engine text window is further capped at 4000 characters for
  signal detection. Very long messages are scanned only in the first portion.
- **Attachments**: not read or processed by this tool; they are ignored. The
  engine operates on subject and body text only.
- **Teams or shared mailboxes**: out of scope for V1 individual; the tool holds
  no shared state and operates on one email at a time.
- **Histories**: no reminder history is stored inside this tool; the caller may
  supply existingReminders for dedup, which is bounded by maxExistingReminders
  (1000). Past that, the array is clamped to prevent excessive iteration.

## Recommendations for a future integration

- Run safeBuildFollowUpReminder (not the raw engine) at any UI or API boundary
  so guards always apply.
- Debounce or cancel in-flight reminders when the user switches messages to
  avoid stale work.
- Keep the caps configurable per deployment if larger bodies or deeper history
  are ever required.
- If integrating with persistent storage for existing reminders, paginate or
  limit the query to the most recent N entries rather than loading the full
  history.
