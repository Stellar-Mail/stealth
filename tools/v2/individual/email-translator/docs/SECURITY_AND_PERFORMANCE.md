# Email Translator Security and Performance Notes

## Threat Assumptions

The isolated Email Translator accepts user-controlled email text and metadata. Until a future issue wires it into the main mail app, this folder must treat all message bodies, subjects, recipients, URLs, HTML, and attachment metadata as untrusted local input.

The tool must not:

- fetch external URLs, images, tracking pixels, or attachment links;
- render HTML directly into the DOM;
- process credentials, recovery codes, private keys, passwords, OTPs, or seed phrases;
- store production mail, wallet, or account data in fixtures;
- modify the main app shell, inbox, wallet, Stellar, routing, database, or shared design-system files.

## Unsafe Input Handling

`services/email-translator-guards.mjs` rejects or clips inputs before any future translation service receives them.

- Active markup such as `script`, `iframe`, `object`, `embed`, `link`, `meta`, or `style` is rejected.
- Credential-looking content is rejected with a review-blocking error.
- HTML tags are stripped into plain text for safe local processing.
- Tracking pixels and external URLs are retained only as inert warning signals; they are never fetched.
- Control characters are removed.
- Recipients are retained only when they are synthetic `.test` addresses in local fixtures.
- Attachment handling keeps bounded metadata only and never opens files.

## Performance Constraints

The guard layer keeps processing bounded:

- subjects are clipped at 280 characters;
- bodies are clipped at 20,000 characters;
- recipient metadata is clipped at 50 rows;
- attachment metadata is clipped at 20 rows;
- estimated translation work is split into 4,000-character segments;
- messages above 12,000 normalized characters are marked for chunked processing.

These limits prevent a future UI or model bridge from attempting unbounded translation on large threads, forwarded histories, or attachment-heavy emails.

## Local Validation

Run from the repository root:

```bash
node --test tools/v2/individual/email-translator/tests/email-translator-guards.test.mjs
```

The test suite validates safe input, hostile markup, secret-looking content, unsupported languages, malformed metadata, and large-body clipping without using network calls or production data.
