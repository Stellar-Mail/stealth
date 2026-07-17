# Vendor Mail Tracker Threat Model

## Threat assumptions

This isolated tool may receive malformed or hostile data from fixture payloads,
manual test input, or future local integrations. The hardening helpers assume
that any string field could contain control characters, script-like tags, or
unexpected whitespace.

## Unsafe inputs covered

- Embedded null bytes or control characters in subject lines and previews.
- Oversized arrays or histories that could trigger unnecessary processing.
- Invalid vendor names, emails, or categories.
- Records containing unexpected nested objects or symbol values.

## Defensive behavior

- Text is trimmed, normalized, and length-capped before it is stored or returned.
- Vendor creation rejects malformed fields early instead of persisting bad data.
- Collections are clamped to a fixed upper bound to avoid large in-memory work.
- Record creation strips unsupported values so downstream consumers receive a predictable shape.

## Performance notes

Large email histories, attachment lists, team rosters, or long vendor threads
should be processed in bounded slices. This tool avoids unnecessary work by
clamping collection size and by making the guard helpers cheap and deterministic.
