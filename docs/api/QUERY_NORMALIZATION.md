# Query String Normalization

All API endpoints that read query parameters route them through
`normalizeSearchParams` (in `src/server/api/request.ts`) before any domain
schema (Zod) sees the data. This guarantees that control characters, oversized
input, empty keys, and Unicode-equivalent sequences are handled consistently
across every endpoint, independent of the schema each route defines.

## Rules

Given a request URL, the following are applied in order, before schema parsing:

| Rule                  | Behavior                                                                                                                                                                      | Response              |
| :-------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------- |
| Total query length    | The raw query string (everything after `?`) may not exceed `maxQueryLength` characters (default **2048**).                                                                    | `414` `bad_request`   |
| Empty parameter name  | A parameter with an empty name (for example `?=value`) is rejected.                                                                                                           | `400` `bad_request`   |
| Control characters    | Any name or value containing a control character is rejected: C0 (`U+0000`–`U+001F`), `DEL` (`U+007F`), or C1 (`U+0080`–`U+009F`). Values are matched after percent-decoding. | `400` `bad_request`   |
| Per-value length      | Each decoded, normalized value may not exceed `maxValueLength` characters (default **1024**).                                                                                 | `414` `bad_request`   |
| Unicode normalization | Every name and value is normalized to **NFC** (Normalization Form C).                                                                                                         | applied, not rejected |

Duplicate parameter names keep **last-value-wins** semantics, matching the
previous `Object.fromEntries` behavior.

## Unicode normalization (NFC)

Parameter names and values are normalized to NFC so that canonically equivalent
sequences validate identically. For example, `é` can arrive as either the
precomposed code point `U+00E9` or as `e` + combining acute accent
(`U+0065 U+0301`); both normalize to the same single-code-point `U+00E9` before
validation.

NFC composes decomposed sequences and never introduces new characters, so
**ASCII values are unaffected**. Cursors, numeric limits, lowercase hex message
IDs and payment hashes, and Stellar addresses all pass through byte-for-byte
unchanged. Normalization is therefore safe for opaque tokens: it removes an
ambiguity class without altering already-canonical input.

## Configuration

`parseSearchParams(request, schema, options?)` and
`normalizeSearchParams(request, options?)` accept optional overrides:

```ts
parseSearchParams(request, schema, {
  maxQueryLength: 2048, // total raw query string length
  maxValueLength: 1024, // per decoded value length
});
```

## Error shape

Rejections throw an `ApiError` and surface through the standard error envelope
(see `src/server/api/errors.ts`), with `status` `400` or `414` and code
`bad_request`. Because normalization runs before schema parsing, malformed query
input fails fast with a transport-level status rather than a domain
`validation_error`.
