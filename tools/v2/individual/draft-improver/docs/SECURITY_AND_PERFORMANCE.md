# Draft Improver Security and Performance Notes

## Threat Assumptions

The isolated Draft Improver accepts user-authored draft text plus optional local context. Until a future issue integrates the tool, every draft, prior-message excerpt, attachment label, and goal is untrusted content.

The tool must not:

- obey instructions embedded inside the draft as system, developer, or tool instructions;
- process passwords, OTPs, recovery codes, private keys, seed phrases, card numbers, or bank identifiers;
- render HTML directly into the DOM;
- open attachments or fetch remote resources;
- store production mail, wallet, account, or customer data in fixtures;
- modify the main app shell, inbox architecture, routing, wallet, Stellar, database, or shared design-system files.

## Unsafe Input Handling

`services/draft-improver-guards.mjs` provides a folder-local guard for future UI or model work.

- Active markup such as `script`, `iframe`, `object`, `embed`, `link`, `meta`, and `style` is rejected.
- Secret-looking drafts are rejected for manual review before improvement.
- Prompt-injection-like text is retained as draft content and surfaced as a warning.
- HTML tags and control characters are stripped from normalized draft text.
- Goals are allowlisted to clarity, tone, brevity, professionalism, grammar, and follow-up.
- Context messages are bounded and rewritten to synthetic `.test` senders when needed.
- Attachment handling keeps bounded metadata only and never opens files.

## Performance Constraints

The guard layer keeps local work bounded:

- drafts are clipped at 16,000 characters;
- context is clipped to the latest 20 messages;
- goals are clipped to 8 entries;
- attachment metadata is clipped to 10 rows;
- workload estimates use 3,000-character segments;
- requests above 9,000 normalized characters are marked for async review instead of inline work.

These limits keep future draft-improvement workflows from doing unnecessary work on long reply chains, pasted histories, or attachment-heavy messages.

## Local Validation

Run from the repository root:

```bash
node --test tools/v2/individual/draft-improver/tests/draft-improver-guards.test.mjs
```

The test suite validates safe drafts, prompt-injection warnings, secret-looking content, active markup rejection, unsupported goals, malformed metadata, and large-draft clipping without network calls or production data.
